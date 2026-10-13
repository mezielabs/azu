import { router } from '@inertiajs/react'
import { useState } from 'react'
import { listStateUrl, nextListState, type ListState } from '@mezielabs/azu/shared'
import {
  AdminLayout,
  DataTable,
  Head,
  Link,
  ListToolbar,
  Pagination,
  type ResourceIndexPageProps,
} from '@mezielabs/azu-react'

/**
 * The resource list (FR-05). Every change (page, size, sort, search)
 * is a URL change through an Inertia partial reload of `list`, so the
 * state survives reload and the server does all the work.
 */
export default function ResourceIndex({ azu, resource, list, abilities }: ResourceIndexPageProps) {
  const [selected, setSelected] = useState<(string | number)[]>([])
  const path = `${azu.path}/resources/${resource.name}`

  function go(change: Partial<ListState>, replace = false) {
    const url = listStateUrl(path, nextListState(list.state, change), {
      defaultPerPage: list.defaultPerPage,
    })
    router.get(url, {}, { only: ['list'], preserveState: true, preserveScroll: true, replace })
  }

  return (
    <AdminLayout azu={azu} title={resource.label}>
      <Head title={resource.label} />
      <div className="azu-page-header">
        <h1
          className="azu-page-title"
          data-azu-page="resource/index"
          data-azu-resource={resource.name}
        >
          {resource.label}
        </h1>
        {abilities.create && (
          <Link href={`${path}/create`} className="azu-button azu-button-primary">
            New {resource.singularLabel.toLowerCase()}
          </Link>
        )}
      </div>
      <ListToolbar
        state={list.state}
        label={resource.label}
        searchable={resource.search.length > 0}
        onSearch={(search) => go({ search }, true)}
        onPerPage={(perPage) => go({ perPage })}
      />
      {selected.length > 0 && (
        <p className="azu-selection-summary" role="status">
          {selected.length} selected
        </p>
      )}
      <DataTable
        label={resource.label}
        columns={resource.columns}
        titleColumn={resource.title}
        rows={list.rows}
        state={list.state}
        timezone={azu.timezone}
        onSort={(sort, direction) => go({ sort, direction })}
        onSelectionChange={setSelected}
        rowHref={(row) =>
          row.abilities.view ? `${path}/${encodeURIComponent(String(row.id))}` : undefined
        }
      />
      <Pagination meta={list.meta} onPage={(page) => go({ page })} />
    </AdminLayout>
  )
}
