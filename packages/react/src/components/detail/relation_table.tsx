import { router, usePage } from '@inertiajs/react'
import { withPageParam, type ListState } from '@mezielabs/azu/shared'
import type { RelationTable } from '@mezielabs/azu/types'
import { DataTable } from '../list/data_table.tsx'
import { Pagination } from '../list/pagination.tsx'

/**
 * A `hasMany` field on the detail page (FR-08): one page of related
 * records, with the related resource's columns. Rows link to their own
 * detail pages when the user may view them. Paging is a partial reload
 * of `relations`, with this table's page in the URL.
 */
export function RelationTableView(props: { table: RelationTable; path: string; timezone: string }) {
  const { table } = props
  const { url } = usePage()
  const state: ListState = {
    page: table.meta.currentPage,
    perPage: table.meta.perPage as ListState['perPage'],
    sort: null,
    direction: 'asc',
    search: '',
    filters: {},
  }

  return (
    <section
      className="azu-relation"
      data-azu-relation={table.name}
      aria-labelledby={`azu-relation-${table.name}`}
    >
      <h2 id={`azu-relation-${table.name}`} className="azu-section-title">
        {table.label}
      </h2>
      <DataTable
        label={table.label}
        columns={table.columns}
        titleColumn={table.titleColumn}
        rows={table.rows}
        state={state}
        timezone={props.timezone}
        onSort={() => {}}
        selectable={false}
        rowHref={(row) =>
          row.abilities.view
            ? `${props.path}/resources/${table.resource}/${encodeURIComponent(String(row.id))}`
            : undefined
        }
      />
      <Pagination
        meta={table.meta}
        onPage={(page) =>
          router.get(
            withPageParam(url, table.pageParam, page),
            {},
            { only: ['relations'], preserveState: true, preserveScroll: true }
          )
        }
      />
    </section>
  )
}
