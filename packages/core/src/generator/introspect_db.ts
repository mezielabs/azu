/**
 * Database facts the generator needs that Lucid's `columnsInfo` (knex's
 * `columnInfo`) doesn't give: decimal precision and scale, enum values
 * (native enums, MySQL's `enum`, and the `CHECK (x IN (...))` knex
 * writes for `table.enum()` on Postgres and SQLite), single-column
 * unique indexes, and foreign keys. One set of queries per dialect.
 */
import type { QueryClientContract } from '@adonisjs/lucid/types/database'

export type ColumnType =
  'string' | 'text' | 'integer' | 'float' | 'decimal' | 'boolean' | 'date' | 'datetime' | 'other'

export type DbColumn = {
  name: string
  type: ColumnType
  maxLength: number | null
  precision: number | null
  scale: number | null
  nullable: boolean
  hasDefault: boolean
  enumValues: string[] | null
  unique: boolean
  references: { table: string; column: string } | null
}

type Row = Record<string, any>

async function rows(client: QueryClientContract, sql: string, bindings: unknown[] = []) {
  const result = await client.rawQuery(sql, bindings as never)
  // pg: { rows }, mysql2: [rows, fields], better-sqlite3: rows
  if (Array.isArray(result)) return (Array.isArray(result[0]) ? result[0] : result) as Row[]
  return (result.rows ?? []) as Row[]
}

/**
 * `'draft'::text, 'published'::text` or `'draft', 'published'` → values
 */
function quotedValues(list: string): string[] {
  return [...list.matchAll(/'((?:[^']|'')*)'/g)].map((match) => match[1].replace(/''/g, "'"))
}

/**
 * Enum values from CHECK constraints, by column. Handles Postgres's
 * `CHECK ((status = ANY (ARRAY['a'::text, ...])))` and SQLite's
 * `check (`status` in ('a', 'b'))`.
 */
export function checkEnums(definitions: string[]): Map<string, string[]> {
  const enums = new Map<string, string[]>()
  for (const definition of definitions) {
    const anyArray = /\(?\s*"?(\w+)"?\s*\)?(?:::\w+)?\s*=\s*ANY\s*\(\s*\(?ARRAY\[(.+?)\]/i.exec(
      definition
    )
    const inList = /[`"[]?(\w+)[`"\]]?\s+in\s*\(([^)]*)\)/i.exec(definition)
    const match = anyArray ?? inList
    if (match) enums.set(match[1], quotedValues(match[2]))
  }
  return enums
}

function normalize(type: string): ColumnType {
  const t = type.toLowerCase()
  if (/^(character varying|varchar|character|char|nvarchar|uuid)/.test(t)) return 'string'
  if (/^(text|mediumtext|longtext|tinytext|clob)/.test(t)) return 'text'
  if (/^(integer|int|bigint|smallint|mediumint|serial|bigserial|tinyint)/.test(t)) return 'integer'
  if (/^(numeric|decimal)/.test(t)) return 'decimal'
  if (/^(real|double|float)/.test(t)) return 'float'
  if (/^(boolean|bool)/.test(t)) return 'boolean'
  if (/^date$/.test(t)) return 'date'
  if (/^(timestamp|datetime)/.test(t)) return 'datetime'
  return 'other'
}

async function postgres(client: QueryClientContract, table: string): Promise<DbColumn[]> {
  const [columns, uniques, foreign, checks] = await Promise.all([
    rows(
      client,
      `select column_name, data_type, udt_name, character_maximum_length, numeric_precision,
        numeric_scale, is_nullable, column_default
       from information_schema.columns
       where table_schema = current_schema() and table_name = ? order by ordinal_position`,
      [table]
    ),
    rows(
      client,
      `select a.attname as column_name from pg_index i
       join pg_class t on t.oid = i.indrelid
       join pg_attribute a on a.attrelid = t.oid and a.attnum = i.indkey[0]
       where t.relname = ? and t.relnamespace = current_schema()::regnamespace
         and i.indisunique and not i.indisprimary and i.indnatts = 1`,
      [table]
    ),
    rows(
      client,
      `select kcu.column_name, ccu.table_name as foreign_table, ccu.column_name as foreign_column
       from information_schema.table_constraints tc
       join information_schema.key_column_usage kcu
         on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
       join information_schema.constraint_column_usage ccu
         on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
       where tc.constraint_type = 'FOREIGN KEY' and tc.table_name = ?
         and tc.table_schema = current_schema()`,
      [table]
    ),
    rows(
      client,
      `select pg_get_constraintdef(c.oid) as definition from pg_constraint c
       join pg_class t on t.oid = c.conrelid
       where c.contype = 'c' and t.relname = ? and t.relnamespace = current_schema()::regnamespace`,
      [table]
    ),
  ])

  const enums = checkEnums(checks.map((row) => row.definition))
  const result: DbColumn[] = []
  for (const column of columns) {
    let values = enums.get(column.column_name) ?? null
    if (column.data_type === 'USER-DEFINED') {
      const labels = await rows(
        client,
        `select e.enumlabel from pg_type t join pg_enum e on e.enumtypid = t.oid
         where t.typname = ? order by e.enumsortorder`,
        [column.udt_name]
      )
      if (labels.length > 0) values = labels.map((row) => row.enumlabel)
    }
    const fk = foreign.find((row) => row.column_name === column.column_name)
    result.push({
      name: column.column_name,
      type: values ? 'string' : normalize(column.data_type),
      maxLength: column.character_maximum_length ?? null,
      precision: column.numeric_precision ?? null,
      scale: column.numeric_scale ?? null,
      nullable: column.is_nullable === 'YES',
      hasDefault: column.column_default !== null,
      enumValues: values,
      unique: uniques.some((row) => row.column_name === column.column_name),
      references: fk ? { table: fk.foreign_table, column: fk.foreign_column } : null,
    })
  }
  return result
}

async function mysql(client: QueryClientContract, table: string): Promise<DbColumn[]> {
  const [columns, uniques, foreign] = await Promise.all([
    rows(
      client,
      `select COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION,
        NUMERIC_SCALE, IS_NULLABLE, COLUMN_DEFAULT
       from information_schema.columns
       where table_schema = database() and table_name = ? order by ORDINAL_POSITION`,
      [table]
    ),
    rows(
      client,
      `select min(COLUMN_NAME) as COLUMN_NAME from information_schema.statistics
       where table_schema = database() and table_name = ? and NON_UNIQUE = 0
         and INDEX_NAME <> 'PRIMARY'
       group by INDEX_NAME having count(*) = 1`,
      [table]
    ),
    rows(
      client,
      `select COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
       from information_schema.key_column_usage
       where table_schema = database() and table_name = ? and REFERENCED_TABLE_NAME is not null`,
      [table]
    ),
  ])

  return columns.map((column) => {
    const columnType = String(column.COLUMN_TYPE).toLowerCase()
    const isEnum = column.DATA_TYPE === 'enum'
    const fk = foreign.find((row) => row.COLUMN_NAME === column.COLUMN_NAME)
    return {
      name: column.COLUMN_NAME,
      // knex stores booleans as tinyint(1)
      type: isEnum
        ? 'string'
        : columnType === 'tinyint(1)'
          ? 'boolean'
          : normalize(column.DATA_TYPE),
      maxLength:
        column.CHARACTER_MAXIMUM_LENGTH === null ? null : Number(column.CHARACTER_MAXIMUM_LENGTH),
      precision: column.NUMERIC_PRECISION === null ? null : Number(column.NUMERIC_PRECISION),
      scale: column.NUMERIC_SCALE === null ? null : Number(column.NUMERIC_SCALE),
      nullable: column.IS_NULLABLE === 'YES',
      hasDefault: column.COLUMN_DEFAULT !== null,
      enumValues: isEnum ? quotedValues(columnType) : null,
      unique: uniques.some((row) => row.COLUMN_NAME === column.COLUMN_NAME),
      references: fk
        ? { table: fk.REFERENCED_TABLE_NAME, column: fk.REFERENCED_COLUMN_NAME }
        : null,
    } satisfies DbColumn
  })
}

async function sqlite(client: QueryClientContract, table: string): Promise<DbColumn[]> {
  const quoted = `"${table.replace(/"/g, '""')}"`
  const [columns, indexes, foreign, [definition]] = await Promise.all([
    rows(client, `pragma table_info(${quoted})`),
    rows(client, `pragma index_list(${quoted})`),
    rows(client, `pragma foreign_key_list(${quoted})`),
    rows(client, `select sql from sqlite_master where type = 'table' and name = ?`, [table]),
  ])

  const unique = new Set<string>()
  for (const index of indexes) {
    if (!index.unique || index.origin === 'pk') continue
    const parts = await rows(
      client,
      `pragma index_info("${String(index.name).replace(/"/g, '""')}")`
    )
    if (parts.length === 1) unique.add(parts[0].name)
  }
  const enums = checkEnums(
    [...String(definition?.sql ?? '').matchAll(/check\s*\(([^)]*\))\)/gi)].map((match) => match[1])
  )

  return columns.map((column) => {
    const type = String(column.type)
    const length = /\((\d+)\)/.exec(type)
    const decimal = /\((\d+)\s*,\s*(\d+)\)/.exec(type)
    const fk = foreign.find((row) => row.from === column.name)
    const values = enums.get(column.name) ?? null
    return {
      name: column.name,
      type: values ? 'string' : normalize(type),
      maxLength: length && !decimal ? Number(length[1]) : null,
      precision: decimal ? Number(decimal[1]) : null,
      scale: decimal ? Number(decimal[2]) : null,
      nullable: !column.notnull,
      hasDefault: column.dflt_value !== null,
      enumValues: values,
      unique: unique.has(column.name),
      references: fk ? { table: fk.table, column: fk.to } : null,
    } satisfies DbColumn
  })
}

/**
 * Every column of a table, with what the generator needs to know.
 */
export async function introspectTable(
  client: QueryClientContract,
  table: string
): Promise<DbColumn[]> {
  const dialect = client.dialect.name
  if (dialect === 'postgres') return postgres(client, table)
  if (dialect === 'mysql') return mysql(client, table)
  if (dialect.includes('sqlite')) return sqlite(client, table)
  throw new Error(`azu:resource doesn't support the "${dialect}" dialect yet`)
}
