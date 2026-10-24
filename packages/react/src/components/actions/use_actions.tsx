import { lazy, Suspense, useState } from 'react'
import { actionUrl, requestAction, type MatchingRows } from '@mezielabs/azu/shared'
import type {
  ActionResponse,
  ActionSchema,
  FieldValue,
  FormErrors,
  ResourceSchema,
} from '@mezielabs/azu/types'
import { showToast } from '../toast.tsx'

/**
 * The dialog renders form fields, so it loads on first use: the list
 * page doesn't carry every form control for a dialog it may not open.
 */
const ActionDialog = lazy(async () => ({
  default: (await import('./action_dialog.tsx')).ActionDialog,
}))

/**
 * What an action runs on: the selected rows, or every row the list's
 * search and filters match (FR-17).
 */
export type ActionTarget = { ids: (string | number)[] } | { matching: MatchingRows }

type Pending = { action: ActionSchema; target: ActionTarget; recordTitle?: string }

/**
 * Runs a resource's actions (FR-12): opens the confirm dialog when the
 * action asks for confirmation or has fields, sends it to the server,
 * and shows the result as a toast. A run on all matching rows always
 * confirms first. `onDone` runs after a success, to reload the page,
 * clear the selection and move focus, including after a run that
 * stopped partway (FR-17), whose committed chunks changed rows.
 */
export function useActions(options: {
  path: string
  resource: ResourceSchema
  timezone: string
  onDone: (result: ActionResponse, action: ActionSchema) => void
}) {
  const [pending, setPending] = useState<Pending | null>(null)
  const [errors, setErrors] = useState<FormErrors>({})
  const [busy, setBusy] = useState(false)

  async function execute(next: Pending, input?: Record<string, FieldValue>) {
    setBusy(true)
    const outcome = await requestAction(
      actionUrl(options.path, options.resource.name, next.action),
      { ...next.target, input }
    )
    setBusy(false)
    if (outcome.ok) {
      setPending(null)
      const message = outcome.result.message ?? `${next.action.label}: done`
      showToast(message, outcome.result.failed > 0 ? 'error' : undefined)
      options.onDone(outcome.result, next.action)
    } else if (outcome.status === 422 && Object.keys(outcome.errors).length > 0) {
      // Keep the dialog open, with the errors under their fields
      setPending(next)
      setErrors(outcome.errors)
    } else {
      setPending(null)
      showToast(outcome.message, 'error')
    }
  }

  function run(action: ActionSchema, target: ActionTarget, recordTitle?: string) {
    setErrors({})
    const next = { action, target, recordTitle }
    if ('matching' in target || action.confirm || action.fields.length > 0) setPending(next)
    else void execute(next)
  }

  const dialog = pending ? (
    <Suspense fallback={null}>
      <ActionDialog
        key={`${pending.action.kind}.${pending.action.name}`}
        action={pending.action}
        recordTitle={pending.recordTitle}
        count={'ids' in pending.target ? pending.target.ids.length : pending.target.matching.count}
        matching={'matching' in pending.target}
        noun={{
          one: options.resource.singularLabel.toLowerCase(),
          many: options.resource.label.toLowerCase(),
        }}
        errors={errors}
        busy={busy}
        timezone={options.timezone}
        onCancel={() => setPending(null)}
        onSubmit={(input) => void execute(pending, input)}
      />
    </Suspense>
  ) : null

  return { run, dialog, busy }
}
