import { Fragment, type ReactNode } from 'react'
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import type { RichTextEditorProps } from './rich_text.ts'

type Mark = {
  /** The button's accessible name and tooltip */
  label: string
  /** Decorative: the label names the button */
  icon: ReactNode
  /** Starts a new group in the toolbar, after a divider */
  group?: boolean
  isActive: (editor: Editor) => boolean
  run: (editor: Editor) => void
}

/**
 * The formatting the server keeps (see sanitize_html.ts in core).
 */
const TOOLS: Mark[] = [
  {
    label: 'Bold',
    icon: <span className="azu-rich-text-glyph azu-is-bold">B</span>,
    isActive: (e) => e.isActive('bold'),
    run: (e) => e.chain().focus().toggleBold().run(),
  },
  {
    label: 'Italic',
    icon: <span className="azu-rich-text-glyph azu-is-italic">I</span>,
    isActive: (e) => e.isActive('italic'),
    run: (e) => e.chain().focus().toggleItalic().run(),
  },
  {
    label: 'Heading',
    icon: <span className="azu-rich-text-glyph">H</span>,
    isActive: (e) => e.isActive('heading', { level: 2 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    label: 'Bulleted list',
    group: true,
    icon: (
      <svg
        aria-hidden="true"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M9 6h11M9 12h11M9 18h11" />
        <circle cx="4.5" cy="6" r="1" />
        <circle cx="4.5" cy="12" r="1" />
        <circle cx="4.5" cy="18" r="1" />
      </svg>
    ),
    isActive: (e) => e.isActive('bulletList'),
    run: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    label: 'Numbered list',
    icon: (
      <svg
        aria-hidden="true"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M10 6h10M10 12h10M10 18h10M4 5h1v4M4 15h2l-2 3h2" />
      </svg>
    ),
    isActive: (e) => e.isActive('orderedList'),
    run: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    label: 'Quote',
    icon: (
      <svg
        aria-hidden="true"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M7 7h4v6H5V9a2 2 0 0 1 2-2zM15 7h4v6h-6V9a2 2 0 0 1 2-2zM5 13c0 2 1 4 3 4M13 13c0 2 1 4 3 4" />
      </svg>
    ),
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
            <Fragment key={tool.label}>
              {tool.group && <span className="azu-rich-text-divider" aria-hidden="true" />}
              <button
                type="button"
                className="azu-rich-text-tool"
                aria-label={tool.label}
                title={tool.label}
                aria-pressed={active?.[index] ?? false}
                // Keep the editor's selection while clicking
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => editor && tool.run(editor)}
              >
                {tool.icon}
              </button>
            </Fragment>
          ))}
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  )
}
