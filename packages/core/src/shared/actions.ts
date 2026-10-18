import type { ActionKey, ActionResponse, ActionSchema, FormErrors, ListRow } from '../schema.ts'
import type { FilterValues } from './list_filters.ts'

/**
 * Records one chunk of a bulk run on all matching rows handles, in its
 * own transaction (FR-17).
 */
export const ACTION_CHUNK_SIZE = 500

/**
 * The most records one bulk run on all matching rows covers. Past it,
 * the run is refused before anything changes (FR-17).
 */
export const MAX_MATCHING_RECORDS = 10_000

/**
 * Every row the list's search and filters match (FR-17), as the bulk
 * toolbar's "Select all N matching" sends it.
 */
export type MatchingRows = {
  search: string
  filters: FilterValues
  /** The count the user saw and confirmed. A run never covers more */
  count: number
}

/**
 * What the action endpoint takes: the selected rows' ids, or every
 * matching row, plus the dialog's input.
 */
export type ActionRequest = ({ ids: (string | number)[] } | { matching: MatchingRows }) & {
  input?: Record<string, unknown>
}

/**
 * The bulk toolbar's summary: `3 selected`, or `All 1,204 matching
 * selected` once the user has chosen every matching row.
 */
export function selectionSummary(selected: number, matching: number | null): string {
  if (matching !== null)
    return `All ${new Intl.NumberFormat('en').format(matching)} matching selected`
  return selected > 0 ? `${selected} selected` : ''
}

/**
 * Whether to offer "Select all N matching": every row on the page is
 * selected, and more rows match than the page shows.
 */
export function offersAllMatching(selected: number, onPage: number, total: number): boolean {
  return onPage > 0 && selected === onPage && total > onPage
}

/**
 * How the bulk bar shows its actions (layout 2/4), so it never wraps:
 * up to three as buttons, destructive last; with more, the first two
 * that aren't destructive as buttons, in declared order, and the rest in
 * a "More" menu, destructive ones last. On a compact screen (below
 * 1024px), all of them in one "Actions" menu.
 */
export function arrangeBulkActions<Action extends Pick<ActionSchema, 'destructive'>>(
  actions: Action[],
  compact: boolean
): { buttons: Action[]; menu: Action[]; menuLabel: 'More' | 'Actions' | null } {
  const plain = actions.filter((action) => !action.destructive)
  const destructive = actions.filter((action) => action.destructive)
  const ordered = [...plain, ...destructive]
  if (ordered.length === 0) return { buttons: [], menu: [], menuLabel: null }
  if (compact) return { buttons: [], menu: ordered, menuLabel: 'Actions' }
  if (ordered.length <= 3) return { buttons: ordered, menu: [], menuLabel: null }
  return {
    buttons: plain.slice(0, 2),
    menu: [...plain.slice(2), ...destructive],
    menuLabel: 'More',
  }
}

/**
 * The confirm dialog's warning for a run that takes more than one
 * chunk, which can partly succeed.
 */
export function chunkedRunNote(count: number): string | null {
  if (count <= ACTION_CHUNK_SIZE) return null
  return (
    `It runs in batches of ${ACTION_CHUNK_SIZE}, each saved on its own. ` +
    "If a batch fails, the ones before it stay done, and you'll see how many were done, skipped and failed."
  )
}

/**
 * `POST` target for an action (FR-12).
 */
export function actionUrl(
  path: string,
  resource: string,
  action: Pick<ActionSchema, 'kind' | 'name'>
) {
  return `${path}/resources/${resource}/actions/${action.kind}/${encodeURIComponent(action.name)}`
}

export function actionKey(action: Pick<ActionSchema, 'kind' | 'name'>): ActionKey {
  return `${action.kind}.${action.name}`
}

/**
 * Bulk actions the user may run on at least one of the selected rows.
 * The server checks each record again and skips the rest.
 */
export function bulkActionsFor(
  actions: ActionSchema[],
  rows: ListRow[],
  selected: (string | number)[]
) {
  const chosen = rows.filter((row) => selected.includes(row.id))
  return actions.filter(
    (action) =>
      action.kind === 'bulk' &&
      chosen.some((row) => row.abilities.actions.includes(actionKey(action)))
  )
}

/**
 * The label of the button that closes an action's dialog without
 * running it: "Cancel", unless the action is itself a cancel.
 */
export function dismissLabel(action: Pick<ActionSchema, 'label'>) {
  return /^cancel\b/i.test(action.label.trim()) ? 'Close' : 'Cancel'
}

export type ActionOutcome =
  | { ok: true; result: ActionResponse }
  | { ok: false; status: number; message: string; errors: FormErrors }

/**
 * The XSRF token AdonisJS's Shield sets in a cookie, for the header
 * Shield checks. Inertia sends it the same way for its own requests.
 */
function xsrfToken(): string | null {
  const match = /(?:^|;\s*)XSRF-TOKEN=([^;]*)/.exec(
    (globalThis as { document?: { cookie?: string } }).document?.cookie ?? ''
  )
  return match ? decodeURIComponent(match[1]) : null
}

/**
 * Runs an action on the server. Browser-only.
 */
export async function requestAction(url: string, body: ActionRequest): Promise<ActionOutcome> {
  const token = xsrfToken()
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { 'X-XSRF-TOKEN': token } : {}),
      },
      body: JSON.stringify(body),
    })
  } catch {
    return {
      ok: false,
      status: 0,
      message: "Couldn't reach the server. Nothing was changed.",
      errors: {},
    }
  }
  const data = (await response.json().catch(() => ({}))) as Partial<ActionResponse> & {
    errors?: FormErrors
  }
  if (response.ok) return { ok: true, result: data as ActionResponse }
  return {
    ok: false,
    status: response.status,
    message: data.message ?? 'The action failed. Nothing was changed.',
    errors: data.errors ?? {},
  }
}
