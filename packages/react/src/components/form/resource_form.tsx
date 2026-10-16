import { Link, router } from '@inertiajs/react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { fieldErrors, unmatchedErrors } from '@mezielabs/azu/shared'
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

function sameValues(a: Values, b: Values) {
  return Object.keys(a).every((name) => comparable(a[name]) === comparable(b[name]))
}

/**
 * The create and edit form (FR-06). It submits to its own URL; the
 * server validates through the resource's validator and either
 * redirects to the detail page or renders the form again with a 422
 * and `errors`. Form state survives that render (`preserveState`).
 */
export function ResourceForm(props: {
  form: ResourceFormData
  errors: FormErrors
  /** The form's own URL, which it submits to */
  action: string
  method: 'post' | 'put'
  timezone: string
  submitLabel: string
  cancelHref: string
  /** Shown as a toast once the record is saved */
  successMessage: string
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

  const dirty = !sameValues(values, initial)
  const other = unmatchedErrors(
    errors,
    form.fields.map((field) => field.input)
  )

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
        data[field.input] = ((value as RelationValue[] | null) ?? []).map((item) => item.id)
      } else {
        data[field.input] = value
      }
    }
    router[props.method](props.action, data as Payload, {
      preserveState: true,
      preserveScroll: true,
      onStart: () => setProcessing(true),
      onFinish: () => setProcessing(false),
      onSuccess: () => showToast(props.successMessage),
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
      {form.fields.map((field) => (
        <FormField
          key={field.name}
          field={field}
          value={values[field.name] ?? null}
          onChange={(value) => {
            setValues((current) => ({ ...current, [field.name]: value }))
            setEdited((current) => new Set(current).add(field.name))
          }}
          errors={edited.has(field.name) ? [] : fieldErrors(errors, field.input)}
          timezone={timezone}
          values={values}
        />
      ))}
      <div className="azu-form-actions">
        <button type="submit" className="azu-button azu-button-primary" disabled={processing}>
          {props.submitLabel}
        </button>
        <Link href={props.cancelHref} className="azu-button">
          Cancel
        </Link>
      </div>
      <UnsavedChanges when={dirty && !processing} />
    </form>
  )
}
