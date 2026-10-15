import { router } from '@inertiajs/react'
import { useEffect, useRef, useState } from 'react'
import {
  actionKey,
  bulkActionsFor,
  listStateUrl,
  nextListState,
  type ListState,
} from '@mezielabs/azu/shared'
import {
  AdminLayout,
  DataTable,
  FilterBar,
  Head,
  Link,
  ListToolbar,
  Pagination,
  RowActionsMenu,
  useActions,
  type ResourceIndexPageProps,
} from '@mezielabs/azu-react'

/**
 * The resource list (FR-05). Every change (page, size, sort, search,
 * filters) is a URL change through an Inertia partial reload of
 * `list`, so the state survives reload, a filtered view can be
 * bookmarked, and the server does all the work.
 *
 * Row actions sit in each row's menu, and bulk actions in a toolbar
 * over the selection (FR-12). After one runs, the list reloads, the
 * selection clears and focus moves to the table (docs/ui-check.md §3).
 */
export default function ResourceIndex({ azu, resource, list, abilities }: ResourceIndexPageProps) {
  const [selected, setSelected] = useState<(string | number)[]>([])
  const [cleared, setCleared] = useState(0)
  const table = useRef<HTMLDivElement>(null)
  const path = `${azu.path}/resources/${resource.name}`

  const actions = useActions({
    path: azu.path,
    resource,
    timezone: azu.timezone,
    onDone: (result) => {
      if (result.redirect) return router.visit(result.redirect)
      setCleared((count) => count + 1)
      router.reload({
        only: ['list'],
        onFinish: () => table.current?.querySelector<HTMLElement>('[role="grid"]')?.focus(),
      })
    },
  })
  const rowActions = resource.actions.filter((action) => action.kind === 'row')
  const bulkActions = bulkActionsFor(resource.actions, list.rows, selected)

  // The state the user last asked for. A second change before the list
  // reloads (typing a search right after picking a filter) builds on
  // the first, not on props the reload hasn't replaced yet
  const [requested, setRequested] = useState<ListState | null>(null)
  useEffect(() => setRequested(null), [list.state])
  const current = requested ?? list.state

  function go(change: Partial<ListState>, replace = false) {
    const next = nextListState(current, change)
    setRequested(next)
    const url = listStateUrl(path, next, { defaultPerPage: list.defaultPerPage })
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
        state={current}
        label={resource.label}
        searchable={resource.search.length > 0}
        onSearch={(search) => go({ search }, true)}
        onPerPage={(perPage) => go({ perPage })}
      />
      <FilterBar
        filters={list.filters}
        values={current.filters}
        label={resource.label}
        onChange={(filters) => go({ filters })}
      />
      {/*
        Always rendered, so the table doesn't move when the first row is
        selected and the next click lands where the user aimed
      */}
      <div className="azu-toolbar azu-bulk-toolbar" role="toolbar" aria-label="Bulk actions">
        <p className="azu-selection-summary" role="status">
          {selected.length > 0 ? `${selected.length} selected` : ''}
        </p>
        {selected.length > 0 &&
          bulkActions.map((action) => (
            <button
              key={action.name}
              type="button"
              className={`azu-button ${action.destructive ? 'azu-button-danger' : ''}`}
              disabled={actions.busy}
              onClick={() => actions.run(action, selected)}
            >
              {action.label}
            </button>
          ))}
      </div>
      <div ref={table}>
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
          clearSelection={cleared}
          rowActions={
            rowActions.length > 0
              ? (row) => (
                  <RowActionsMenu
                    actions={rowActions.filter((action) =>
                      row.abilities.actions.includes(actionKey(action))
                    )}
                    title={row.title ?? String(row.id)}
                    onAction={(action) => actions.run(action, [row.id])}
                  />
                )
              : undefined
          }
        />
      </div>
      {actions.dialog}
      <Pagination meta={list.meta} onPage={(page) => go({ page })} />
    </AdminLayout>
  )
}
