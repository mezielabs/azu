// inertia/admin/components/sku_input.tsx
import type { FieldProps } from '@mezielabs/azu-react'

export default function SkuInput({ field, value, onChange, errors }: FieldProps<string>) {
  return (
    <label className="azu-field">
      <span className="azu-label">{field.label}</span>
      <input
        className="azu-input"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        aria-invalid={errors.length > 0}
      />
      {errors.length > 0 && <span className="azu-field-error">{errors.join(' ')}</span>}
    </label>
  )
}
