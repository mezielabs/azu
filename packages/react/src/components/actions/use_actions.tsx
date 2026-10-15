import { lazy, Suspense, useState } from 'react'
import { actionUrl, requestAction } from '@mezielabs/azu/shared'
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

type Pending = { action: ActionSchema; ids: (string | number)[] }

/**
 * Runs a resource's actions (FR-12): opens the confirm dialog when the
 * action asks for confirmation or has fields, sends it to the server,
 * and shows the result as a toast. `onDone` runs after a success, to
 * reload the page, clear the selection and move focus.
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
      {
        ids: next.ids,
        input,
      }
    )
    setBusy(false)
    if (outcome.ok) {
      setPending(null)
      showToast(outcome.result.message ?? `${next.action.label}: done`)
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

  function run(action: ActionSchema, ids: (string | number)[]) {
    setErrors({})
    const next = { action, ids }
    if (action.confirm || action.fields.length > 0) setPending(next)
    else void execute(next)
  }

  const dialog = pending ? (
    <Suspense fallback={null}>
      <ActionDialog
        key={`${pending.action.kind}.${pending.action.name}`}
        action={pending.action}
        count={pending.ids.length}
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
