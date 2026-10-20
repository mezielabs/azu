import { Link, router } from '@inertiajs/react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  AFTER_SAVE_INPUT,
  EMPTY_RELATION_IDS,
  fieldErrors,
  fieldWidth,
  formStatus,
  unmatchedErrors,
} from '@mezielabs/azu/shared'
import type { FieldValue, FormErrors, RelationValue, ResourceFormData } from '@mezielabs/azu/types'
import { showToast } from '../toast.tsx'
import { FormField } from './form_field.tsx'
import { UnsavedChanges } from './unsaved_changes.tsx'

/**
 * Form state: field values, plus a newly chosen `File` for uploads.
 */
type Values = Record<string, FieldValue | File>

/**
 * What Inertia accepts as visit data; `@inertiajs/react` doesn't export the type.
 */
type Payload = NonNullable<Parameters<typeof router.post>[1]>

/**
 * Relations compare by id and stored files by key: picking the same
 * record again isn't a change. A chosen file always is.
 */
function comparable(value: FieldValue | File | undefined) {
  if (value instanceof File || value === null || typeof value !== 'object') return value
  // manyToMany: the same records, in any order
  if (Array.isArray(value))
    return value
      .map((item) => String(item.id))
      .sort()
      .join(',')
  return 'id' in value ? value.id : value.key
}

function hasErrors(props: Record<string, unknown>) {
  return Object.keys((props.errors as FormErrors | undefined) ?? {}).length > 0
}

/**
 * After a save that comes back to a form: a fresh create form focuses
 * its first field; the edit form keeps focus on the button that saved.
 */
function focusAfterSave(destination: 'create' | 'edit') {
  requestAnimationFrame(() => {
    const target =
      destination === 'create'
        ? document.querySelector<HTMLElement>(
            '.azu-form-body :is(input:not([type="hidden"]), textarea, select, button, [contenteditable="true"])'
          )
        : document.querySelector<HTMLElement>('[data-azu-after="edit"]')
    target?.focus()
  })
}

function sameValues(a: Values, b: Values) {
  return Object.keys(a).every((name) => comparable(a[name]) === comparable(b[name]))
}

/**
 * The create and edit form (FR-06), and a form screen's (FR-23). It submits to its own URL; the
 * server validates through the resource's validator and either
 * redirects or renders the form again with a 422 and `errors`. Form
 * state survives only that render (`preserveState: 'errors'`), so a
 * redirect back to a form (`secondary`) starts from the server's
 * values.
 *
 * The secondary button ("Create & add another", "Save & keep editing")
 * sends `_after`, which picks where a successful save goes; the
 * primary one, and Enter in a field, go to the detail page.
 */
export function ResourceForm(props: {
  form: ResourceFormData
  errors: FormErrors
  /** The form's own URL, which it submits to */
  action: string
  method: 'post' | 'put'
  timezone: string
  submitLabel: string
  /** Where Cancel goes; no Cancel without one (a form screen, FR-23) */
  cancelHref?: string
  /** Shown as a toast once the record is saved */
  successMessage: string
  /**
   * The button that saves and comes back: to a fresh create form
   * (`create`) or this edit form (`edit`). `short` is its label on
   * phones.
   */
  secondary?: { label: string; short: string; after: 'create' | 'edit' }
  /** The new record's detail page, for the toast's View link after `create` */
  savedHref?: (record: { id: string | number }) => string
}) {
  const { form, errors, timezone } = props
  const [initial] = useState(form.values)
  const [values, setValues] = useState(form.values)
  const [processing, setProcessing] = useState(false)
  // Fields edited since the last submit: their old errors no longer apply
  const [edited, setEdited] = useState<ReadonlySet<string>>(new Set())
  useEffect(() => setEdited(new Set()), [errors])
  const element = useRef<HTMLFormElement>(null)
  const summary = useRef<HTMLDivElement>(null)
  // Set by the secondary button for the submit it starts
  const after = useRef<'show' | 'create' | 'edit'>('show')

  const dirty = !sameValues(values, initial)
  const other = unmatchedErrors(
    errors,
    form.fields.map((field) => field.input)
  )
  const shownErrors = (name: string, input: string) =>
    edited.has(name) ? [] : fieldErrors(errors, input)
  const status = formStatus({
    dirty,
    invalid: form.fields.filter((field) => shownErrors(field.name, field.input).length > 0).length,
  })

  /**
   * After a 422, focus the first invalid field, or the summary when
   * only errors without a field came back.
   */
  function focusFirstError() {
    requestAnimationFrame(() => {
      const invalid = element.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
      ;(invalid ?? summary.current)?.focus()
    })
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    // Each field submits under its input: a belongsTo field sends its
    // foreign key, a manyToMany field its records' keys (`tagIds`).
    // A read-only manyToMany field isn't sent: it may show only some of
    // the attached records. Datetimes go as the exact instant the picker
    // resolved; the server hands them to the validator in the format
    // vine.date() expects.
    // Uploads send a chosen File, or null to remove the stored file; an
    // untouched upload isn't sent, so the server keeps it. With a File in
    // the data, Inertia sends multipart form data.
    const multipart = Object.values(values).some((value) => value instanceof File)
    const data: Record<string, unknown> = {}
    for (const field of form.fields) {
      const value = values[field.name] ?? null
      if (field.kind === 'file' || field.kind === 'image') {
        if (comparable(value) !== comparable(initial[field.name] ?? null)) {
          data[field.input] = value
        }
      } else if (field.kind === 'belongsTo') {
        data[field.input] = (value as RelationValue | null)?.id ?? null
      } else if (field.kind === 'manyToMany') {
        if (field.readOnly) continue
        // The related records' keys: `tagIds`
        const ids = ((value as RelationValue[] | null) ?? []).map((item) => item.id)
        data[field.input] = multipart && ids.length === 0 ? EMPTY_RELATION_IDS : ids
      } else {
        data[field.input] = value
      }
    }
    const destination = after.current
    after.current = 'show'
    if (destination !== 'show') data[AFTER_SAVE_INPUT] = destination
    router[props.method](props.action, data as Payload, {
      // Kept only for a 422: a redirect back here shows the server's values
      preserveState: 'errors',
      // A fresh create form starts at the top
      preserveScroll: (page) => hasErrors(page.props) || destination !== 'create',
      onStart: () => setProcessing(true),
      onFinish: () => setProcessing(false),
      onSuccess: (page) => {
        const saved = (page.props as { saved?: { id: string | number } | null }).saved
        showToast(
          props.successMessage,
          'success',
          destination === 'create' && saved && props.savedHref
            ? { label: 'View', href: props.savedHref(saved) }
            : null
        )
        if (destination !== 'show') focusAfterSave(destination)
      },
      onError: focusFirstError,
    })
  }

  return (
    <form ref={element} className="azu-form" onSubmit={submit} noValidate>
      {other.length > 0 && (
        <div ref={summary} className="azu-form-errors" role="alert" tabIndex={-1}>
          {other.map((message, index) => (
            <p key={index}>{message}</p>
          ))}
        </div>
      )}
      {/* Short fields pair up side by side on a wide form */}
      <div className="azu-form-body">
        {form.fields.map((field) => (
          <div key={field.name} className="azu-form-cell" data-azu-width={fieldWidth(field)}>
            <FormField
              field={field}
              value={values[field.name] ?? null}
              onChange={(value) => {
                setValues((current) => ({ ...current, [field.name]: value }))
                setEdited((current) => new Set(current).add(field.name))
              }}
              errors={shownErrors(field.name, field.input)}
              timezone={timezone}
              values={values}
            />
          </div>
        ))}
      </div>
      {/* Stays at the bottom of the window while the form scrolls */}
      <div className="azu-save-bar">
        <div className="azu-save-bar-inner">
          <p
            className="azu-save-status"
            title={status ?? undefined}
            role="status"
            data-azu-state={dirty ? 'dirty' : status ? 'invalid' : 'clean'}
          >
            {status}
          </p>
          <div className="azu-save-actions">
            {props.cancelHref && (
              <Link href={props.cancelHref} className="azu-button">
                Cancel
              </Link>
            )}
            {props.secondary && (
              // Not a submit button, so Enter in a field still uses the primary one
              <button
                type="button"
                className="azu-button"
                data-azu-after={props.secondary.after}
                disabled={processing}
                onClick={() => {
                  after.current = props.secondary!.after
                  element.current?.requestSubmit()
                }}
              >
                <span className="azu-label-wide">{props.secondary.label}</span>
                <span className="azu-label-narrow">{props.secondary.short}</span>
              </button>
            )}
            <button type="submit" className="azu-button azu-button-primary" disabled={processing}>
              {props.submitLabel}
            </button>
          </div>
        </div>
      </div>
      <UnsavedChanges
        when={dirty && !processing}
        submit={{ method: props.method, url: props.action }}
      />
    </form>
  )
}
