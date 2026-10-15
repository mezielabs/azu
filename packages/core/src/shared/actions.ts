import type { ActionKey, ActionResponse, ActionSchema, FormErrors, ListRow } from '../schema.ts'

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
export async function requestAction(
  url: string,
  body: { ids: (string | number)[]; input?: Record<string, unknown> }
): Promise<ActionOutcome> {
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
