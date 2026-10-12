/**
 * SPIKE (Phase 1 UI check). Stand-in the azu() Vite plugin swaps in for
 * @mezielabs/azu-react/rich-text-editor when Tiptap isn't installed: a
 * plain textarea plus the install hint.
 */
import type { RichTextEditorProps } from './editor.tsx'

export default function RichTextMissing({ value, onChange }: RichTextEditorProps) {
  return (
    <div className="azu-rich-text" data-azu-rich-text="missing">
      <p className="azu-check-meta">
        Rich text needs @tiptap/react, @tiptap/pm and @tiptap/starter-kit. Showing a plain textarea.
      </p>
      <textarea className="azu-input" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}
