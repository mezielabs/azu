import type { FieldProps, FieldValue, FormFieldSchema } from '@mezielabs/azu/types'
import { useComponent } from '../registry.tsx'
import {
  BooleanControl,
  DateControl,
  DateTimeControl,
  NumberControl,
  SelectControl,
  TextControl,
  type ControlProps,
} from './controls.tsx'

/**
 * One form field, by kind, or the app's component when the field names
 * one (`field.text('sku').component('SkuInput')`). Custom components
 * get `FieldProps`.
 */
export function FormField(props: ControlProps & { values: Record<string, FieldValue> }) {
  const { field, value, onChange, errors, values } = props
  const Custom = useComponent(field.component ?? undefined)

  if (Custom) {
    const custom: FieldProps<FieldValue> = { value, onChange, errors, field, record: values }
    return (
      <div className="azu-field" data-azu-field={field.name}>
        <Custom {...custom} />
      </div>
    )
  }

  switch (field.kind) {
    case 'textarea':
      return <TextControl {...props} multiline />
    case 'number':
      return <NumberControl {...props} />
    case 'decimal':
      return <TextControl {...props} decimal />
    case 'boolean':
      return <BooleanControl {...props} />
    case 'select':
      return <SelectControl {...props} />
    case 'date':
      return <DateControl {...props} />
    case 'datetime':
      return <DateTimeControl {...props} />
    default:
      return <TextControl {...props} />
  }
}

export type { FormFieldSchema }
