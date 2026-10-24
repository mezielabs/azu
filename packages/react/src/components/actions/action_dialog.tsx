import { lazy, Suspense, useState, type FormEvent } from 'react'
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components'
import { chunkedRunNote, dismissLabel } from '@mezielabs/azu/shared'
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
  /** Display context for a single row, never submitted as action input. */
  recordTitle?: string
  /** It runs on every matching row (FR-17), not a selection */
  matching?: boolean
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

  const total = new Intl.NumberFormat('en').format(count)
  const target = props.matching
    ? `all ${total} matching ${count === 1 ? props.noun.one : props.noun.many}`
    : count === 1
      ? `1 ${props.noun.one}`
      : `${total} ${props.noun.many}`
  // "delete" is reserved for Azu's built-in permanent deletion.
  const deleting = action.name === 'delete'
  const deleteTarget =
    action.kind === 'row' && props.recordTitle
      ? `“${props.recordTitle}”`
      : props.matching
        ? target
        : `${total} selected ${count === 1 ? props.noun.one : props.noun.many}`
  // A run in more than one chunk can partly succeed: say so up front
  const note = props.matching ? chunkedRunNote(count) : null

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
              {deleting
                ? `Delete ${deleteTarget}?`
                : (action.confirm ?? `${action.label} ${target}?`)}
              {!deleting && action.kind === 'bulk' && action.confirm && (
                <span className="azu-dialog-count"> ({target})</span>
              )}
            </p>
            {deleting && (
              <p className="azu-dialog-body">
                This permanently deletes {count === 1 ? 'the record' : 'these records'} and cannot
                be undone.
              </p>
            )}
            {note && <p className="azu-dialog-body azu-dialog-note">{note}</p>}
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
