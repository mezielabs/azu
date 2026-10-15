import type { RichTextEditorProps } from './rich_text.ts'

/**
 * Used instead of the Tiptap editor when the app hasn't installed
 * Tiptap's packages: the field's HTML in a plain textarea. The server
 * sanitises it either way.
 */
export default function RichTextFallback(props: RichTextEditorProps) {
  return (
    <div className="azu-rich-text">
      <textarea
        className="azu-input azu-textarea"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value === '' ? null : event.target.value)}
        readOnly={props.readOnly}
        aria-labelledby={props.labelId}
        aria-describedby={props.describedBy}
        aria-invalid={props.invalid}
      />
      <p className="azu-description">
        HTML. Install @tiptap/react, @tiptap/pm and @tiptap/starter-kit for the rich text editor.
      </p>
    </div>
  )
}
