/**
 * Up to two initials for the sidebar's avatar: from a name's first and
 * last words (`Ada Lovelace` → `AL`), else the start of an email
 * (`ada@azu.test` → `AD`). Empty when there's neither.
 */
export function initials(user: { name: string | null; email: string | null }): string {
  const words = (user.name ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length > 1) return `${words[0][0]}${words.at(-1)![0]}`.toUpperCase()
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (user.email ?? '').split('@')[0].slice(0, 2).toUpperCase()
}
