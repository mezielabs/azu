// inertia/admin/components/sku_input.tsx
import { useId } from 'react'
import type { FieldProps } from '@mezielabs/azu-react'

export default function SkuInput({ field, value, onChange, errors }: FieldProps<string>) {
  const id = useId()
  const errorId = `${id}-error`
  return (
    <div className="azu-field">
      <label className="azu-label" htmlFor={id}>
        {field.label}
        {field.required && (
          <span className="azu-required" aria-hidden>
            {' '}
            *
          </span>
        )}
      </label>
      <input
        id={id}
        name={field.name}
        className="azu-input"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        required={field.required}
        aria-invalid={errors.length > 0}
        aria-describedby={errors.length > 0 ? errorId : undefined}
      />
      {errors.length > 0 && (
        <span id={errorId} className="azu-field-error">
          {errors.join(' ')}
        </span>
      )}
    </div>
  )
}
