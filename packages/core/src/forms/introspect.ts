/**
 * Form hints read from a compiled VineJS 4 validator (spike-findings §2).
 *
 * Two public methods on a VineJS validator feed it:
 *
 * - `toJSONSchema()` (JSON Schema draft 7) for constraints: required,
 *   lengths, minimum/maximum, enum, array sizes.
 * - `toJSON()` (the compiled nodes) for what JSON Schema loses: the data
 *   type (`subtype: 'date'`), optional and nullable flags, conditional
 *   rules such as `requiredWhen`, and decimal places.
 *
 * Hints are for the UI only. The server always validates through the
 * validator itself.
 */

/**
 * The subset of JSON Schema draft 7 read here. VineJS types it with
 * `json-schema`'s `JSONSchema7` without depending on its types package,
 * so it isn't imported.
 */
type JSONSchema = {
  type?: string | string[]
  properties?: Record<string, JSONSchemaDefinition>
  items?: JSONSchemaDefinition | JSONSchemaDefinition[]
  enum?: unknown[]
  minLength?: number
  maxLength?: number
  minimum?: number
  maximum?: number
  minItems?: number
  maxItems?: number
}
type JSONSchemaDefinition = JSONSchema | boolean

type CompiledNode = {
  type: string
  subtype?: string
  propertyName?: string
  isOptional?: boolean
  allowNull?: boolean
  validations?: { ruleFnId: string; name?: string; implicit: boolean }[]
  properties?: CompiledNode[]
  each?: CompiledNode
}

type Refs = Record<string, { options?: { range?: [number, number] } } | undefined>

/**
 * What introspection needs from a validator: VineJS 4's `vine.create()`
 * output has both methods.
 */
export type IntrospectableValidator = {
  toJSON(): { schema: object; refs: object }
  toJSONSchema(): object
}

export type FieldHints = {
  /** Dot path, with `*` for array items: `variants.*.sku` */
  path: string
  /** The compiled node's type, or its subtype: `string`, `number`, `date`, `enum`, … */
  kind: string
  /** Not optional, not nullable, and no conditional rule */
  required: boolean
  nullable: boolean
  /** Has a rule such as `requiredWhen` that only the server can evaluate */
  conditional: boolean
  minLength: number | null
  maxLength: number | null
  min: number | null
  max: number | null
  step: number | null
  choices: string[] | null
  minItems: number | null
  maxItems: number | null
}

function asSchema(definition: JSONSchemaDefinition | undefined): JSONSchema {
  return typeof definition === 'object' ? definition : {}
}

function isType(json: JSONSchema, type: string) {
  return Array.isArray(json.type) ? json.type.includes(type) : json.type === type
}

function collect(
  node: CompiledNode,
  json: JSONSchema,
  refs: Refs,
  path: string,
  out: FieldHints[]
) {
  if (path) {
    const rules = node.validations ?? []
    const decimal = rules.find((rule) => rule.name === 'decimal')
    const places = decimal ? refs[decimal.ruleFnId]?.options?.range?.[1] : undefined
    const conditional = rules.some((rule) => rule.implicit)

    out.push({
      path,
      kind: node.subtype ?? node.type,
      required: !node.isOptional && !node.allowNull && !conditional,
      nullable: !!node.allowNull,
      conditional,
      minLength: json.minLength ?? null,
      maxLength: json.maxLength ?? null,
      min: json.minimum ?? null,
      max: json.maximum ?? null,
      step: places !== undefined ? 10 ** -places : isType(json, 'integer') ? 1 : null,
      choices: node.subtype === 'enum' && json.enum ? json.enum.map(String) : null,
      minItems: json.minItems ?? null,
      maxItems: json.maxItems ?? null,
    })
  }

  for (const child of node.properties ?? []) {
    const name = child.propertyName!
    collect(child, asSchema(json.properties?.[name]), refs, path ? `${path}.${name}` : name, out)
  }

  if (node.each) {
    const items = Array.isArray(json.items) ? json.items[0] : json.items
    collect(node.each, asSchema(items), refs, `${path}.*`, out)
  }
}

const cache = new WeakMap<object, Map<string, FieldHints>>()

/**
 * Hints for every property path a validator declares, keyed by path.
 * Unions and conditional groups are skipped, because their shape depends
 * on the data. Cached per validator.
 */
export function introspectValidator(validator: IntrospectableValidator): Map<string, FieldHints> {
  const cached = cache.get(validator)
  if (cached) return cached

  const compiled = validator.toJSON() as { schema: { schema: CompiledNode }; refs: Refs }
  const out: FieldHints[] = []
  collect(compiled.schema.schema, validator.toJSONSchema() as JSONSchema, compiled.refs, '', out)

  const hints = new Map(out.map((hint) => [hint.path, hint]))
  cache.set(validator, hints)
  return hints
}

/**
 * Whether a validator can be introspected. Anything with `validate()`
 * can validate, but only VineJS 4 validators give hints.
 */
export function isIntrospectable(validator: unknown): validator is IntrospectableValidator {
  const candidate = validator as Partial<IntrospectableValidator> | null
  return typeof candidate?.toJSON === 'function' && typeof candidate?.toJSONSchema === 'function'
}
