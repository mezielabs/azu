/**
 * SPIKE (Phase 1 UI check). Rich text field: the editor is a separate
 * subpath (@mezielabs/azu-react/rich-text-editor), loaded lazily, so
 * Tiptap is fetched only when a rich text field renders.
 */
import { lazy, Suspense } from 'react'

const RichTextEditor = lazy(() => import('@mezielabs/azu-react/rich-text-editor'))

export function RichTextField(props: { value: string; onChange: (html: string) => void }) {
  return (
    <Suspense fallback={<p className="azu-check-meta">Loading editor…</p>}>
      <RichTextEditor value={props.value} onChange={props.onChange} />
    </Suspense>
  )
}
