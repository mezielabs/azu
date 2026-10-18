import { useEffect, useState } from 'react'

/** Below 768px: the shell's drawer, the list's cards */
export const PHONE_QUERY = '(max-width: 767px)'

/** Below 1024px: the filters sheet, and the bulk bar's one Actions menu */
export const COMPACT_QUERY = '(max-width: 1023px)'

/**
 * Whether a media query matches, kept up to date. Azu's pages render in
 * the browser only, so the first render already has the answer.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  )
  useEffect(() => {
    const list = window.matchMedia(query)
    const update = () => setMatches(list.matches)
    update()
    list.addEventListener('change', update)
    return () => list.removeEventListener('change', update)
  }, [query])
  return matches
}
