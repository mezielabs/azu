import type { RelationOption } from '../schema.ts'

/** Explicit empty selection: FormData serialization otherwise drops empty arrays. */
export const EMPTY_RELATION_IDS = '[]'

/**
 * Fetches a `belongsTo` field's or filter's options from its
 * policy-checked endpoint, matching `search`. Browser-only. Pass the
 * signal so a newer search can abort this one, and the last response
 * wins.
 */
export async function fetchRelationOptions(
  url: string,
  search: string,
  signal?: AbortSignal
): Promise<RelationOption[]> {
  const location = (globalThis as { location?: { origin: string } }).location
  const target = new URL(url, location?.origin)
  if (search) target.searchParams.set('search', search)
  const response = await fetch(target, {
    signal,
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`Options request failed with ${response.status}`)
  return ((await response.json()) as { options: RelationOption[] }).options
}
