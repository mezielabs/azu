/**
 * The name an app component registers under, from its file in
 * `inertia/admin/components`: `sku_input.tsx` → `SkuInput`. The admin
 * entry registers components this way, and `admin:doctor` checks that
 * every name a resource uses has a file.
 */
export function componentName(path: string): string {
  const file = path
    .split('/')
    .pop()!
    .replace(/\.[jt]sx?$/, '')
  return file
    .split(/[_-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}
