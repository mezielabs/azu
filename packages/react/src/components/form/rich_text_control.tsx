import { lazy, Suspense, useId } from 'react'
import { FieldLabelText, type ControlProps } from './controls.tsx'

/**
 * Loaded on demand: the Tiptap editor, or its fallback when Tiptap
 * isn't installed (azu() picks, see the "azu" field in package.json).
 */
const Editor = lazy(() => import('@mezielabs/azu-react/rich-text'))

/**
 * A `richText` field (FR-07). The server sanitises the HTML before the
 * validator sees it, and again before showing it.
 */
export function RichTextControl(props: ControlProps) {
  const { field, value, onChange, errors } = props
  const labelId = useId()
  const descriptionId = useId()
  const errorId = useId()
  const describedBy = [field.help ? descriptionId : null, errors.length > 0 ? errorId : null]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="azu-field" data-azu-field={field.name}>
      <span id={labelId} className="azu-label">
        <FieldLabelText field={field} />
      </span>
      <Suspense
        fallback={
          <div className="azu-rich-text azu-is-loading" aria-busy="true">
            Loading editor…
          </div>
        }
      >
        <Editor
          value={typeof value === 'string' ? value : ''}
          onChange={onChange}
          labelId={labelId}
          describedBy={describedBy}
          invalid={errors.length > 0}
          readOnly={field.readOnly}
        />
      </Suspense>
      {field.help && (
        <p id={descriptionId} className="azu-description">
          {field.help}
        </p>
      )}
      {errors.length > 0 && (
        <p id={errorId} className="azu-field-error">
          {errors.join(' ')}
        </p>
      )}
    </div>
  )
}
