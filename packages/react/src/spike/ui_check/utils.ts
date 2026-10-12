/**
 * SPIKE (Phase 1 UI check). Throwaway; see docs/ui-check.md.
 */
export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

/**
 * Shield's XSRF cookie, for fetch() POSTs outside Inertia's router.
 */
export function xsrfToken() {
  const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : ''
}
