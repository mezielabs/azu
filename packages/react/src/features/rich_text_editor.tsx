import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import type { RichTextEditorProps } from './rich_text.ts'

type Mark = {
  label: string
  isActive: (editor: Editor) => boolean
  run: (editor: Editor) => void
}

/**
 * The formatting the server keeps (see sanitize_html.ts in core).
 */
const TOOLS: Mark[] = [
  {
    label: 'Bold',
    isActive: (e) => e.isActive('bold'),
    run: (e) => e.chain().focus().toggleBold().run(),
  },
  {
    label: 'Italic',
    isActive: (e) => e.isActive('italic'),
    run: (e) => e.chain().focus().toggleItalic().run(),
  },
  {
    label: 'Heading',
    isActive: (e) => e.isActive('heading', { level: 2 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    label: 'Bulleted list',
    isActive: (e) => e.isActive('bulletList'),
    run: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    label: 'Numbered list',
    isActive: (e) => e.isActive('orderedList'),
    run: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    label: 'Quote',
    isActive: (e) => e.isActive('blockquote'),
    run: (e) => e.chain().focus().toggleBlockquote().run(),
  },
]

/**
 * The `richText` editor (FR-07): Tiptap 3 with StarterKit, loaded
 * lazily so pages without rich text never download it. The editable
 * area is labelled by the field's label, which the UI check found
 * missing (docs/ui-check.md §4).
 */
export default function RichTextEditor(props: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ link: { openOnClick: false } })],
    content: props.value,
    editable: !props.readOnly,
    editorProps: {
      attributes: {
        'class': 'azu-rich-text-content',
        'role': 'textbox',
        'aria-multiline': 'true',
        'aria-labelledby': props.labelId,
        'aria-describedby': props.describedBy,
        'aria-invalid': props.invalid ? 'true' : 'false',
      },
    },
    onUpdate: ({ editor: current }) => props.onChange(current.isEmpty ? null : current.getHTML()),
  })

  const active = useEditorState({
    editor,
    selector: ({ editor: current }) => (current ? TOOLS.map((tool) => tool.isActive(current)) : []),
  })

  return (
    <div className="azu-rich-text">
      {!props.readOnly && (
        <div className="azu-rich-text-toolbar" role="toolbar" aria-label="Formatting">
          {TOOLS.map((tool, index) => (
            <button
              key={tool.label}
              type="button"
              className="azu-button azu-rich-text-tool"
              aria-pressed={active?.[index] ?? false}
              // Keep the editor's selection while clicking
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => editor && tool.run(editor)}
            >
              {tool.label}
            </button>
          ))}
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  )
}
