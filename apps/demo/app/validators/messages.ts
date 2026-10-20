import vine, { SimpleMessagesProvider } from '@vinejs/vine'
import type { FieldContext } from '@vinejs/vine/types'

/**
 * The admin's error messages, written to sit under a labelled field:
 * "Price must be at least 0", not "The price field must be at least 0".
 * `{{ field }}` is the label passed to `labelled()`, and starts each
 * message so its capital reads naturally.
 */
export const messages = {
  'required': '{{ field }} is required',
  'string': '{{ field }} must be text',
  'number': '{{ field }} must be a number',
  'boolean': '{{ field }} must be yes or no',
  'date': '{{ field }} must be a date',
  'minLength': '{{ field }} must be at least {{ min }} characters',
  'maxLength': '{{ field }} must be {{ max }} characters or fewer',
  'min': '{{ field }} must be at least {{ min }}',
  'max': '{{ field }} must be {{ max }} or less',
  'withoutDecimals': '{{ field }} must be a whole number',
  'regex': '{{ field }} is not in the right format',
  'enum': '{{ field }} must be one of the options',
  'array.maxLength': '{{ field }} can have {{ max }} at most',
  'database.unique': '{{ field }} is already taken',
  'database.exists': '{{ field }} was not found',
}

/**
 * Gives a validator the admin's messages and the field labels to use
 * in them, keyed by input name (`categoryId`, not `category`).
 */
export function labelled<Validator extends { messagesProvider: unknown }>(
  validator: Validator,
  fields: Record<string, string>,
  overrides: Record<string, string> = {}
): Validator {
  validator.messagesProvider = new SimpleMessagesProvider({ ...messages, ...overrides }, fields)
  return validator
}

/**
 * A lower bound for a decimal kept as a string, checked after the
 * format, so "-5" reads "Price must be at least 0" rather than failing
 * the format.
 */
export const minDecimal = vine.createRule(
  (value: unknown, options: { min: number }, field: FieldContext) => {
    if (typeof value !== 'string') return
    if (Number(value) < options.min) {
      field.report(messages.min, 'min', field, options)
    }
  }
)

/**
 * An upper bound for a decimal kept as a string, as `minDecimal`
 */
export const maxDecimal = vine.createRule(
  (value: unknown, options: { max: number }, field: FieldContext) => {
    if (typeof value !== 'string') return
    if (Number(value) > options.max) {
      field.report(messages.max, 'max', field, options)
    }
  }
)

/**
 * A decimal with up to 10 digits and 2 places, as an exact string
 */
export const decimalString = (min: number) =>
  vine
    .string()
    .trim()
    .regex(/^-?\d{1,10}(\.\d{1,2})?$/)
    .use(minDecimal({ min }))
