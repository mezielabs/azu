/**
 * The contract between the rich text field and its editor module, so
 * the Tiptap editor and its fallback are interchangeable (azu() swaps
 * one for the other when Tiptap isn't installed).
 */
export type RichTextEditorProps = {
  value: string
  /** `null` when the editor is empty */
  onChange: (html: string | null) => void
  labelId: string
  describedBy: string
  invalid: boolean
  readOnly: boolean
}
