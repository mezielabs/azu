import { lazy, Suspense, useState, type FormEvent } from 'react'
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components'
import { dismissLabel } from '@mezielabs/azu/shared'
import type { ActionSchema, FieldValue, FormErrors } from '@mezielabs/azu/types'

const DialogFields = lazy(async () => ({
  default: (await import('./dialog_fields.tsx')).DialogFields,
}))

/**
 * The confirm dialog for an action (FR-12), with the action's fields
 * when it has any. Errors come from the server (the action's
 * validator), under each field. The fields load on demand, so a
 * confirm-only dialog stays small.
 */
export function ActionDialog(props: {
  action: ActionSchema
  /** Records it will run on */
  count: number
  noun: { one: string; many: string }
  errors: FormErrors
  busy: boolean
  timezone: string
  onCancel: () => void
  onSubmit: (input: Record<string, FieldValue>) => void
}) {
  const { action, count } = props
  const [values, setValues] = useState<Record<string, FieldValue>>(() =>
    Object.fromEntries(
      action.fields.map((field) => [
        field.name,
        field.kind === 'boolean' ? Boolean(field.default) : field.default,
      ])
    )
  )

  // A dialog with fields starts in the first one (once it loads);
  // otherwise, and for a destructive action, on Cancel
  const startInFields = action.fields.length > 0 && !action.destructive

  function submit(event: FormEvent) {
    event.preventDefault()
    props.onSubmit(values)
  }

  const target = count === 1 ? `1 ${props.noun.one}` : `${count} ${props.noun.many}`

  return (
    <ModalOverlay
      className="azu-modal-overlay"
      isOpen
      isDismissable={!props.busy}
      onOpenChange={(open) => !open && props.onCancel()}
    >
      <Modal className="azu-modal">
        <Dialog role="alertdialog" className="azu-dialog" data-azu-action={action.name}>
          <form onSubmit={submit} noValidate className="azu-action-form">
            <Heading slot="title" className="azu-dialog-title">
              {action.label}
            </Heading>
            <p className="azu-dialog-body">
              {action.confirm ?? `${action.label} ${target}?`}
              {action.kind === 'bulk' && action.confirm && (
                <span className="azu-dialog-count"> ({target})</span>
              )}
            </p>
            {action.fields.length > 0 && (
              <Suspense fallback={null}>
                <DialogFields
                  fields={action.fields}
                  values={values}
                  onChange={(name, value) =>
                    setValues((current) => ({ ...current, [name]: value }))
                  }
                  errors={props.errors}
                  timezone={props.timezone}
                  autoFocus={startInFields}
                />
              </Suspense>
            )}
            <div className="azu-dialog-actions">
              <Button
                className="azu-button"
                onPress={props.onCancel}
                isDisabled={props.busy}
                autoFocus={!startInFields}
              >
                {dismissLabel(action)}
              </Button>
              <Button
                type="submit"
                className={`azu-button ${action.destructive ? 'azu-button-danger' : 'azu-button-primary'}`}
                isDisabled={props.busy}
              >
                {action.label}
              </Button>
            </div>
          </form>
        </Dialog>
      </Modal>
    </ModalOverlay>
  )
}
