/**
 * SPIKE (Phase 1 UI check). Tiptap 3 editor, published as the
 * @mezielabs/azu-react/rich-text-editor subpath so it loads lazily and
 * only when @tiptap/* is installed.
 */
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

export type RichTextEditorProps = { value: string; onChange: (html: string) => void }

export default function RichTextEditor({ value, onChange }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    onUpdate: ({ editor: instance }) => onChange(instance.getHTML()),
  })

  return (
    <div className="azu-rich-text" data-azu-rich-text="tiptap">
      <div className="azu-toolbar" role="toolbar" aria-label="Formatting">
        <button
          type="button"
          className="azu-button"
          aria-pressed={editor?.isActive('bold') ?? false}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          Bold
        </button>
        <button
          type="button"
          className="azu-button"
          aria-pressed={editor?.isActive('bulletList') ?? false}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          List
        </button>
      </div>
      <EditorContent editor={editor} className="azu-rich-text-content" />
    </div>
  )
}
