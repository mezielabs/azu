import type { FormErrors } from '../schema.ts'

/**
 * Whether an error path belongs to a field: its own name, or a path
 * under it (`tags.0`, `variants.1.sku`).
 */
function belongsTo(path: string, name: string) {
  return path === name || path.startsWith(`${name}.`)
}

/**
 * The messages to show under a field, including those for nested and
 * array paths under it.
 */
export function fieldErrors(errors: FormErrors, name: string): string[] {
  return Object.entries(errors)
    .filter(([path]) => belongsTo(path, name))
    .flatMap(([, messages]) => messages)
}

/**
 * Messages for paths no shown field covers, such as a validator rule
 * on an attribute the form doesn't show. The form lists them at the
 * top, so no error is ever silently dropped.
 */
export function unmatchedErrors(errors: FormErrors, names: string[]): string[] {
  return Object.entries(errors)
    .filter(([path]) => !names.some((name) => belongsTo(path, name)))
    .flatMap(([, messages]) => messages)
}
