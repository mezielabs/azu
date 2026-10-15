import { useEffect, useRef } from 'react'
import { fieldErrors } from '@mezielabs/azu/shared'
import type { FieldValue, FormErrors, FormFieldSchema } from '@mezielabs/azu/types'
import { FormField } from '../form/form_field.tsx'

/**
 * An action dialog's fields (FR-12). Loaded only for actions with
 * `.fields()`, so a confirm-only dialog never loads the form controls;
 * the controls themselves are the chunk the create and edit pages use.
 */
export function DialogFields(props: {
  fields: FormFieldSchema[]
  values: Record<string, FieldValue>
  onChange: (name: string, value: FieldValue) => void
  errors: FormErrors
  timezone: string
  /** Move focus to the first field once it's rendered */
  autoFocus: boolean
}) {
  const container = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!props.autoFocus) return
    container.current
      ?.querySelector<HTMLElement>('input:not([type="hidden"]), textarea, select')
      ?.focus()
  }, [props.autoFocus])

  return (
    <div ref={container} className="azu-dialog-fields">
      {props.fields.map((field) => (
        <FormField
          key={field.name}
          field={field}
          value={props.values[field.name] ?? null}
          onChange={(value) => props.onChange(field.name, value)}
          errors={fieldErrors(props.errors, field.name)}
          timezone={props.timezone}
          values={props.values}
        />
      ))}
    </div>
  )
}
