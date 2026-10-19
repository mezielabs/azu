import string from '@adonisjs/core/helpers/string'

/**
 * Acronyms a label spells in capitals: `sku` reads "SKU", `userId`
 * "User ID", `imageUrls` "Image URLs".
 */
export const LABEL_ACRONYMS: ReadonlySet<string> = new Set([
  'SKU',
  'ID',
  'URL',
  'API',
  'VAT',
  'UUID',
])

/**
 * A name as a label: sentence case, with known acronyms in capitals,
 * plurals included. Only for labels Azu makes up; an explicit
 * `label()` is used as written.
 */
export function humanize(name: string): string {
  // Each word, split into a stem and an optional plural "s"
  return string
    .sentenceCase(name)
    .replace(/\b([A-Za-z]+?)(s?)\b/g, (word, stem: string, plural: string) =>
      LABEL_ACRONYMS.has(stem.toUpperCase()) ? stem.toUpperCase() + plural : word
    )
}
