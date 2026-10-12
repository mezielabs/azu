/**
 * SPIKE (Phase 0, risk check 2). Throwaway.
 *
 * Reads form hints (required, lengths, min/max, step, choices) from a
 * compiled VineJS 4 validator at runtime.
 *
 * Two public methods on `VineValidator` feed it:
 *
 * - `toJSONSchema()` (JSON Schema draft 7): the documented contract. Gives
 *   required, minLength/maxLength, minimum/maximum, pattern, enum,
 *   minItems/maxItems. Loses dates, decimal places, and booleans.
 * - `toJSON()` (compiled nodes + refs): gives the exact data type
 *   (`subtype: 'date'`), optional/nullable flags, implicit rules such as
 *   `requiredWhen`, and each rule's options (`decimal` → `{ range: [0, 2] }`).
 *
 * JSON Schema wins for constraints; compiled nodes fill the gaps.
 */

/**
 * The subset of JSON Schema draft 7 we read. VineJS types this as
 * `JSONSchema7` from `json-schema` but doesn't depend on
 * `@types/json-schema`, so we don't import it.
 */
type JSONSchema7 = {
  type?: string | string[]
  properties?: Record<string, JSONSchema7Definition>
  items?: JSONSchema7Definition | JSONSchema7Definition[]
  required?: string[]
  enum?: unknown[]
  minLength?: number
  maxLength?: number
  minimum?: number
  maximum?: number
  pattern?: string
  minItems?: number
  maxItems?: number
}
type JSONSchema7Definition = JSONSchema7 | boolean

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

type Refs = Record<string, { options?: any } | undefined>

type CompiledValidator = {
  toJSON(): { schema: object; refs: object }
  toJSONSchema(): object
}

export type FieldHints = {
  /** Dot path, with `*` for array items: `variants.*.sku` */
  path: string
  kind: string
  /** Statically required: not optional and not nullable */
  required: boolean
  nullable: boolean
  /** Has an implicit rule (requiredWhen, requiredIfExists, ...) the form can't evaluate */
  conditional: boolean
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  step?: number
  integer?: boolean
  pattern?: string
  choices?: unknown[]
  minItems?: number
  maxItems?: number
}

function asSchema(definition: JSONSchema7Definition | undefined): JSONSchema7 {
  return typeof definition === 'object' ? definition : {}
}

function collect(
  node: CompiledNode,
  json: JSONSchema7,
  refs: Refs,
  path: string,
  out: FieldHints[]
) {
  if (path) {
    const rules = node.validations ?? []
    const decimal = rules.find((rule) => rule.name === 'decimal')
    const places = decimal ? refs[decimal.ruleFnId]?.options?.range?.[1] : undefined

    out.push({
      path,
      kind: node.subtype ?? node.type,
      required: !node.isOptional && !node.allowNull,
      nullable: !!node.allowNull,
      conditional: rules.some((rule) => rule.implicit),
      minLength: json.minLength,
      maxLength: json.maxLength,
      min: json.minimum,
      max: json.maximum,
      step: places !== undefined ? 10 ** -places : json.type === 'integer' ? 1 : undefined,
      integer: json.type === 'integer' || undefined,
      pattern: json.pattern,
      choices: node.subtype === 'enum' ? json.enum : undefined,
      minItems: json.minItems,
      maxItems: json.maxItems,
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

/**
 * Returns a flat list of field hints, one per property path. Unions and
 * conditional groups are skipped: their shape depends on the data, so the
 * form can't know it ahead of time.
 */
export function introspectValidator(validator: CompiledValidator): FieldHints[] {
  const compiled = validator.toJSON() as { schema: { schema: CompiledNode }; refs: Refs }
  const out: FieldHints[] = []
  collect(compiled.schema.schema, validator.toJSONSchema() as JSONSchema7, compiled.refs, '', out)
  return out.map(
    (hints) =>
      Object.fromEntries(
        Object.entries(hints).filter(([, value]) => value !== undefined)
      ) as FieldHints
  )
}
