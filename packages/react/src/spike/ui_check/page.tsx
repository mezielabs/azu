/**
 * SPIKE (Phase 1 week-one UI check). Throwaway; see docs/ui-check.md.
 * Rendered at /admin/ui-check by apps/demo/spike/ui_check_routes.ts.
 */
import { useState } from 'react'
import type { SortDescriptor } from 'react-aria-components'
import { AdminLayout, Head } from '@mezielabs/azu-react'
import type { AzuSharedProps } from '@mezielabs/azu/types'
import { CategoryCombobox } from './category_combobox.tsx'
import { ZonedDatePicker } from './zoned_date_picker.tsx'
import { ProductsTable, type ProductRow } from './products_table.tsx'
import { RichTextField } from './rich_text_field.tsx'

type Props = AzuSharedProps & {
  timezone: string
  sort: SortDescriptor
  products: ProductRow[]
  dates: { regular: string; dstEdge: string }
  flash: string | null
}

export default function UiCheck(props: Props) {
  const [showRichText, setShowRichText] = useState(false)
  const [html, setHtml] = useState('<p>Hello <strong>Azu</strong></p>')

  return (
    <AdminLayout azu={props.azu} title="UI check">
      <Head title="UI check" />
      <h1 className="azu-page-title" data-azu-page="spike/ui_check">
        Week-one UI check
      </h1>
      {props.flash && (
        <p className="azu-flash" role="status" data-azu-check-result="flash">
          {props.flash}
        </p>
      )}

      <section className="azu-section">
        <h2>1. Async belongsTo combobox</h2>
        <CategoryCombobox path={props.azu.path} delay={400} />
      </section>

      <section className="azu-section">
        <h2>2. Timezone-aware date picker ({props.timezone})</h2>
        <ZonedDatePicker
          id="regular"
          label="Published at"
          iso={props.dates.regular}
          timezone={props.timezone}
          path={props.azu.path}
        />
        <ZonedDatePicker
          id="dst"
          label="Around the DST change"
          iso={props.dates.dstEdge}
          timezone={props.timezone}
          path={props.azu.path}
        />
      </section>

      <section className="azu-section">
        <h2>3. List table, keyboard selection, bulk action</h2>
        <ProductsTable path={props.azu.path} products={props.products} sort={props.sort} />
      </section>

      <section className="azu-section">
        <h2>4. Lazily loaded rich text</h2>
        <button
          type="button"
          className="azu-button"
          onClick={() => setShowRichText(true)}
          disabled={showRichText}
        >
          Show rich text field
        </button>
        {showRichText && <RichTextField value={html} onChange={setHtml} />}
        <p className="azu-check-meta" data-azu-check-result="rich-text">
          html={html}
        </p>
      </section>
    </AdminLayout>
  )
}
