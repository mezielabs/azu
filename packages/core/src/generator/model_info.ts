import { existsSync } from 'node:fs'
import type { LucidModel } from '@adonisjs/lucid/types/model'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import { baseType, declaredTypes, literalUnion } from './declared_types.ts'
import { introspectTable, type DbColumn } from './introspect_db.ts'
import { manyToManyInput } from '../forms/form_fields.ts'

export type FieldKind =
  | 'text'
  | 'textarea'
  | 'richText'
  | 'number'
  | 'decimal'
  | 'boolean'
  | 'select'
  | 'date'
  | 'datetime'
  | 'belongsTo'

export type RelationPlan = {
  /** The relation, e.g. `category` */
  name: string
  related: LucidModel
  relatedTable: string
  relatedKeyColumn: string
  /** The related model's attribute that names a record */
  title: string | null
}

/**
 * A `manyToMany` relation (FR-09): a picker field, and an array of
 * related keys in the validator.
 */
export type ManyToManyPlan = {
  /** The relation, e.g. `tags` */
  name: string
  /** What the field submits and the validator checks: `tagIds` */
  input: string
  relatedTable: string
  relatedKeyColumn: string
  /** Whether the related key is an integer column */
  integerKey: boolean
  /** The related model's attribute that names a record */
  title: string | null
}

export type FieldPlan = {
  /** The field's name: the attribute, or the relation for `belongsTo` */
  name: string
  /** The attribute written, which the validator checks (`categoryId`) */
  input: string
  column: DbColumn
  kind: FieldKind
  /** `select`: the values */
  options: string[] | null
  relation: RelationPlan | null
}

export type ModelPlan = {
  model: LucidModel
  table: string
  primaryKey: string
  primaryKeyColumn: string
  fields: FieldPlan[]
  /** `manyToMany` relations, after the column fields */
  manyToMany: ManyToManyPlan[]
  title: string | null
  search: string[]
  /** An auto-created datetime, shown as a hidden-by-default column */
  createdAt: string | null
  /** Required database columns no field covers, e.g. `password`: no create */
  uncovered: string[]
  /** Columns the generator couldn't map, and why */
  skipped: string[]
}

type ColumnDefinition = {
  columnName: string
  isPrimary: boolean
  serializeAs: string | null
  meta?: { type?: string; autoCreate?: boolean; autoUpdate?: boolean } | null
}

type RelationDefinition = {
  type: string
  booted: boolean
  boot(): void
  relatedModel(): LucidModel
  foreignKey?: string
  localKey?: string
  relatedKey?: string
}

/** Never admin fields (spec §7) */
const SECRET = new Set(['password', 'rememberMeToken'])
/** String columns named like long text become rich text (spec §7) */
const RICH_TEXT = new Set(['description', 'body', 'content'])
/** Preferred title attributes, in order (spec §7) */
const TITLES = ['name', 'title', 'email']

export type ModelFiles = {
  /** The model's source file, for its declared types */
  modelFile: (model: LucidModel) => string
  /** database/schema.ts */
  schemaFile: string
}

function definitions(model: LucidModel) {
  model.boot()
  return [...(model.$columnsDefinitions as Map<string, ColumnDefinition>)]
}

function pickTitle(candidates: string[]) {
  return TITLES.find((name) => candidates.includes(name)) ?? candidates[0] ?? null
}

/**
 * String attributes of a model that are persisted columns, for the
 * related model's title.
 */
async function stringColumns(model: LucidModel, client: QueryClientContract, files: ModelFiles) {
  const file = files.modelFile(model)
  const types = existsSync(file) ? await declaredTypes(file, files.schemaFile) : new Map()
  // Lucid sets `table` (and the column metadata) when a model boots;
  // in an app that hasn't used the model yet, it isn't booted
  model.boot()
  const columns = await introspectTable(client, model.table)
  return definitions(model)
    .filter(([attribute, definition]) => {
      if (definition.isPrimary || SECRET.has(attribute) || definition.serializeAs === null)
        return false
      const declared = baseType(types.get(attribute))
      const db = columns.find((column) => column.name === definition.columnName)
      return declared ? declared === 'string' : db?.type === 'string' || db?.type === 'text'
    })
    .map(([attribute]) => attribute)
}

function kindFor(
  attribute: string,
  column: DbColumn,
  declared: string | undefined,
  definition: ColumnDefinition
): { kind: FieldKind; options: string[] | null } | string {
  const type = baseType(declared)
  const union = literalUnion(declared)
  const isDate = definition.meta?.type === 'date' || definition.meta?.type === 'datetime'

  if (union) return { kind: 'select', options: union }
  if (type === 'boolean' || (!type && column.type === 'boolean'))
    return { kind: 'boolean', options: null }
  if (type === 'DateTime' || (!type && (column.type === 'date' || column.type === 'datetime'))) {
    const dateOnly = definition.meta?.type === 'date' || (!isDate && column.type === 'date')
    return { kind: dateOnly ? 'date' : 'datetime', options: null }
  }
  if (type === 'number' || (!type && (column.type === 'integer' || column.type === 'float'))) {
    return { kind: 'number', options: null }
  }
  if (type === 'string' || !type) {
    if (column.enumValues) return { kind: 'select', options: column.enumValues }
    if (column.type === 'decimal' || column.type === 'float')
      return { kind: 'decimal', options: null }
    if (column.type === 'string' || column.type === 'text') {
      if (RICH_TEXT.has(attribute)) return { kind: 'richText', options: null }
      return { kind: column.type === 'text' ? 'textarea' : 'text', options: null }
    }
  }
  return `${attribute}: a ${declared ?? column.type} column has no field type`
}

/**
 * Everything the generator needs to know about a model: its fields,
 * with kinds that compile against the model's types and rules that
 * match its database columns.
 */
export async function planModel(
  model: LucidModel,
  client: QueryClientContract,
  files: ModelFiles
): Promise<ModelPlan> {
  // Lucid sets `table` (and the column metadata) when a model boots;
  // in an app that hasn't used the model yet, it isn't booted
  model.boot()
  const columns = await introspectTable(client, model.table)
  const types = await declaredTypes(files.modelFile(model), files.schemaFile)
  const relations = [...(model.$relationsDefinitions as Map<string, RelationDefinition>)].map(
    ([name, relation]) => {
      if (!relation.booted) relation.boot()
      return { name, relation }
    }
  )

  const fields: FieldPlan[] = []
  const skipped: string[] = []
  const covered = new Set<string>()
  let primaryKeyColumn = model.primaryKey
  let createdAt: string | null = null

  for (const [attribute, definition] of definitions(model)) {
    const column = columns.find((item) => item.name === definition.columnName)
    if (definition.isPrimary) {
      primaryKeyColumn = definition.columnName
      covered.add(definition.columnName)
      continue
    }
    if (definition.meta?.autoCreate || definition.meta?.autoUpdate) {
      if (definition.meta.autoCreate && !definition.meta.autoUpdate) createdAt = attribute
      covered.add(definition.columnName)
      continue
    }
    if (SECRET.has(attribute) || definition.serializeAs === null || !column) continue

    const belongsTo = relations.find(
      ({ relation }) => relation.type === 'belongsTo' && relation.foreignKey === attribute
    )
    if (belongsTo) {
      const related = belongsTo.relation.relatedModel()
      const relatedResourceTitle = pickTitle(await stringColumns(related, client, files))
      fields.push({
        name: belongsTo.name,
        input: attribute,
        column,
        kind: 'belongsTo',
        options: null,
        relation: {
          name: belongsTo.name,
          related,
          relatedTable: column.references?.table ?? related.table,
          relatedKeyColumn: column.references?.column ?? 'id',
          title: relatedResourceTitle,
        },
      })
      covered.add(definition.columnName)
      continue
    }

    const kind = kindFor(attribute, column, types.get(attribute), definition)
    if (typeof kind === 'string') {
      skipped.push(kind)
      continue
    }
    fields.push({ name: attribute, input: attribute, column, ...kind, relation: null })
    covered.add(definition.columnName)
  }

  const manyToMany: ManyToManyPlan[] = []
  for (const { name, relation } of relations) {
    if (relation.type !== 'manyToMany') continue
    const related = relation.relatedModel()
    related.boot()
    const key = relation.relatedKey ?? related.primaryKey
    const keyColumn = related.$getColumn(key)?.columnName ?? key
    const relatedColumns = await introspectTable(client, related.table)
    manyToMany.push({
      name,
      input: manyToManyInput(name),
      relatedTable: related.table,
      relatedKeyColumn: keyColumn,
      integerKey: relatedColumns.find((column) => column.name === keyColumn)?.type === 'integer',
      title: pickTitle(await stringColumns(related, client, files)),
    })
  }

  // In the table's own column order, not the model's (schema classes are alphabetical)
  const position = (field: FieldPlan) =>
    columns.findIndex((column) => column.name === field.column.name)
  fields.sort((a, b) => position(a) - position(b))

  const strings = fields.filter((field) => field.kind === 'text').map((field) => field.name)
  const uncovered = columns
    .filter((column) => !column.nullable && !column.hasDefault && !covered.has(column.name))
    .map((column) => column.name)

  return {
    model,
    table: model.table,
    primaryKey: model.primaryKey,
    primaryKeyColumn,
    fields,
    manyToMany,
    title: pickTitle(strings),
    search: strings.slice(0, 2),
    createdAt,
    uncovered,
    skipped,
  }
}
