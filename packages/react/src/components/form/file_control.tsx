import { useEffect, useId, useMemo, useState } from 'react'
import { Button, DropZone, FileTrigger, type FileDropItem } from 'react-aria-components'
import type { FileValue } from '@mezielabs/azu/types'
import { FieldLabelText, type ControlProps } from './controls.tsx'

const cx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(' ')

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * A preview URL for a newly chosen image, released when it changes.
 */
function usePreview(file: File | null) {
  const url = useMemo(
    () => (file?.type.startsWith('image/') ? URL.createObjectURL(file) : null),
    [file]
  )
  useEffect(() => () => (url ? URL.revokeObjectURL(url) : undefined), [url])
  return url
}

/**
 * A `file` or `image` field (FR-07): drag and drop, or choose a file,
 * with a preview. The server checks size and type again, from the
 * file's contents, whatever the browser says. The value is the stored
 * file, a newly chosen `File`, or `null` once removed.
 */
export function FileControl(
  props: Omit<ControlProps, 'value' | 'onChange'> & {
    value: FileValue | File | null
    onChange: (value: FileValue | File | null) => void
  }
) {
  const { field, value, onChange, errors } = props
  const labelId = useId()
  const descriptionId = useId()
  const errorId = useId()
  // What was stored when the form opened, for Undo
  const [original] = useState(value instanceof File ? null : value)
  const chosen = value instanceof File ? value : null
  const stored = value && !(value instanceof File) ? value : null
  const preview = usePreview(chosen)
  const isImage = field.kind === 'image'
  const imageUrl = preview ?? (isImage ? stored?.url : null)
  const accept = field.accept ?? []
  const disabled = field.readOnly

  const describedBy = [descriptionId, errors.length > 0 ? errorId : null].filter(Boolean).join(' ')

  return (
    <div className="azu-field" data-azu-field={field.name}>
      <span id={labelId} className="azu-label">
        <FieldLabelText field={field} />
      </span>
      <DropZone
        aria-labelledby={labelId}
        aria-describedby={describedBy}
        isDisabled={disabled}
        className={({ isDropTarget, isFocusVisible }) =>
          cx(
            'azu-drop-zone',
            isDropTarget && 'azu-is-drop-target',
            isFocusVisible && 'azu-is-focused',
            errors.length > 0 && 'azu-is-invalid'
          )
        }
        getDropOperation={(types) =>
          accept.length === 0 || accept.some((type) => types.has(type) || type.endsWith('/*'))
            ? 'copy'
            : 'cancel'
        }
        onDrop={async (event) => {
          const item = event.items.find((entry): entry is FileDropItem => entry.kind === 'file')
          if (item) onChange(await item.getFile())
        }}
      >
        <div className="azu-file">
          {imageUrl && <img className="azu-file-preview" src={imageUrl} alt="" />}
          <div className="azu-file-body">
            {chosen ? (
              <p className="azu-file-name">
                {chosen.name} <span className="azu-file-size">({formatSize(chosen.size)})</span>
              </p>
            ) : stored ? (
              <p className="azu-file-name">
                {stored.url ? (
                  <a href={stored.url} target="_blank" rel="noopener noreferrer">
                    {stored.name}
                  </a>
                ) : (
                  stored.name
                )}
              </p>
            ) : (
              <p className="azu-file-empty">Drop a file here, or choose one</p>
            )}
            {!disabled && (
              <div className="azu-file-actions">
                <FileTrigger
                  acceptedFileTypes={accept}
                  onSelect={(files) => {
                    const file = files?.item(0)
                    if (file) onChange(file)
                  }}
                >
                  <Button className="azu-button">
                    {stored || chosen ? 'Replace' : 'Choose file'}
                  </Button>
                </FileTrigger>
                {stored && !field.required && (
                  <Button className="azu-button" onPress={() => onChange(null)}>
                    Remove
                  </Button>
                )}
                {(chosen || (original && !stored)) && (
                  <Button className="azu-button" onPress={() => onChange(original)}>
                    Undo
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </DropZone>
      <p id={descriptionId} className="azu-description">
        {[field.help, `Up to ${field.maxSize}`].filter(Boolean).join('. ')}
      </p>
      {errors.length > 0 && (
        <p id={errorId} className="azu-field-error">
          {errors.join(' ')}
        </p>
      )}
    </div>
  )
}
