/**
 * The TypeScript types a model declares for its columns, read from its
 * source: the model file, and the generated schema class it extends
 * (`ProductSchema` from `#database/schema`). The generator needs them
 * because the resource it writes must compile against the model: a
 * `string` decimal takes `field.decimal()`, never `field.number()`, and
 * SQLite can't tell those apart. Plain text matching, for the code
 * AdonisJS generates and its conventions; no TypeScript compiler.
 */
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'

/**
 * The body of `class Name ... {` up to its matching brace.
 */
function classBody(source: string, name: string | null): string | null {
  const pattern = name
    ? new RegExp(`class\\s+${name}\\b[^{]*\\{`)
    : /export\s+default\s+class\s+\w+[^{]*\{/
  const start = pattern.exec(source)
  if (!start) return null
  let depth = 1
  let index = start.index + start[0].length
  const from = index
  while (index < source.length && depth > 0) {
    if (source[index] === '{') depth++
    else if (source[index] === '}') depth--
    index++
  }
  return source.slice(from, index - 1)
}

function declarations(body: string): Map<string, string> {
  const types = new Map<string, string>()
  for (const match of body.matchAll(/^\s*declare\s+(\w+)\??\s*:\s*([^\n;]+?)\s*;?\s*$/gm)) {
    types.set(match[1], match[2].trim())
  }
  return types
}

/**
 * Declared types by attribute, e.g. `price → 'string'`,
 * `status → "'draft' | 'published'"`. The model's own declarations win
 * over its schema class's.
 */
export async function declaredTypes(
  modelFile: string,
  schemaFile: string
): Promise<Map<string, string>> {
  const source = await readFile(modelFile, 'utf8')
  const types = new Map<string, string>()

  const schemaClasses = [
    ...source.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]#database\/schema['"]/g),
  ]
    .flatMap((match) => match[1].split(','))
    .map((name) => name.trim().split(/\s+as\s+/)[0])
    .filter(Boolean)
  if (schemaClasses.length > 0 && existsSync(schemaFile)) {
    const schema = await readFile(schemaFile, 'utf8')
    for (const name of schemaClasses) {
      for (const [attribute, type] of declarations(classBody(schema, name) ?? '')) {
        types.set(attribute, type)
      }
    }
  }

  for (const [attribute, type] of declarations(classBody(source, null) ?? '')) {
    types.set(attribute, type)
  }
  return types
}

/**
 * `"'draft' | 'published' | null"` → `['draft', 'published']`, or `null`
 * when the type isn't a union of string literals.
 */
export function literalUnion(type: string | undefined): string[] | null {
  if (!type) return null
  const parts = type
    .split('|')
    .map((part) => part.trim())
    .filter((part) => part !== 'null' && part !== 'undefined')
  if (parts.length === 0 || !parts.every((part) => /^'(?:[^'\\]|\\.)*'$/.test(part))) return null
  return parts.map((part) => part.slice(1, -1))
}

/**
 * The non-null base type: `'string | null'` → `'string'`.
 */
export function baseType(type: string | undefined): string | null {
  if (!type) return null
  const parts = type
    .split('|')
    .map((part) => part.trim())
    .filter((part) => part !== 'null' && part !== 'undefined')
  return parts.length === 1 ? parts[0] : literalUnion(type) ? 'string' : null
}
