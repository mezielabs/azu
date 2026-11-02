/**
 * The page's Content Security Policy nonce, or undefined without one
 * (#65). Read from the admin view's `<meta property="csp-nonce">`, the
 * same tag React Aria reads, so styles Azu inserts at runtime (the list
 * table's held column widths, Tiptap's editor styles) pass a strict
 * `style-src 'nonce-…'` policy. Browsers hide a nonce attribute's value
 * from `getAttribute()` once the page loads, so this reads `.nonce`.
 */
export function cspNonce(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const meta = document.querySelector<HTMLMetaElement>('meta[property="csp-nonce"]')
  return meta?.nonce || undefined
}
