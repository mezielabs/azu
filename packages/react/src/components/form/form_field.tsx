import { lazy, Suspense } from 'react'
import type { FieldProps, FieldValue, FileValue, FormFieldSchema } from '@mezielabs/azu/types'
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
import { RelationControl } from './relation_control.tsx'
import { RichTextControl } from './rich_text_control.tsx'

/**
 * The upload UI (React Aria's DropZone and FileTrigger) is its own
 * chunk, so forms without file or image fields don't load it.
 */
const FileControl = lazy(async () => ({
  default: (await import('./file_control.tsx')).FileControl,
}))

/**
 * The `manyToMany` picker (React Aria's TagGroup) is its own chunk too,
 * so forms without one don't load it.
 */
const RelationsControl = lazy(async () => ({
  default: (await import('./relations_control.tsx')).RelationsControl,
}))

/**
 * One form field, by kind, or the app's component when the field names
 * one (`field.text('sku').component('SkuInput')`). Custom components
 * get `FieldProps`, and may load lazily: until then, a placeholder the
 * size of a labelled input holds their place.
 */
export function FormField(props: ControlProps & { values: Record<string, FieldValue> }) {
  const { field, value, onChange, errors, values } = props
  const Custom = useComponent(field.component ?? undefined)

  if (Custom) {
    const custom: FieldProps<FieldValue> = { value, onChange, errors, field, record: values }
    return (
      <div className="azu-field" data-azu-field={field.name}>
        {/* A label and an input's height, so the form doesn't move when it loads */}
        <Suspense
          fallback={
            <div className="azu-field" aria-busy="true">
              <span className="azu-label">{field.label}</span>
              <div className="azu-input azu-placeholder" aria-hidden="true">
                {'\u00a0'}
              </div>
            </div>
          }
        >
          <Custom {...custom} />
        </Suspense>
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
    case 'belongsTo':
      return <RelationControl {...props} />
    case 'manyToMany':
      return (
        <Suspense
          fallback={
            <div className="azu-field" data-azu-field={field.name} aria-busy="true">
              <span className="azu-label">{field.label}</span>
              <div className="azu-tag-list">Loading…</div>
            </div>
          }
        >
          <RelationsControl {...props} />
        </Suspense>
      )
    case 'richText':
      return <RichTextControl {...props} />
    case 'file':
    case 'image':
      return (
        <Suspense
          fallback={
            <div className="azu-field" data-azu-field={field.name} aria-busy="true">
              <span className="azu-label">{field.label}</span>
              <div className="azu-drop-zone azu-is-loading">Loading…</div>
            </div>
          }
        >
          <FileControl
            {...props}
            value={props.value as FileValue | File | null}
            onChange={props.onChange as (value: FileValue | File | null) => void}
          />
        </Suspense>
      )
    default:
      return <TextControl {...props} />
  }
}

export type { FormFieldSchema }
