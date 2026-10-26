import { router } from '@inertiajs/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  actionKey,
  visibleListColumns,
  splitActions,
  bulkActionsFor,
  listStateUrl,
  emptyListMessage,
  nextListState,
  offersAllMatching,
  resourceBreadcrumbs,
  selectionSummary,
  type ListState,
} from '@mezielabs/azu/shared'
import {
  ActionsMenu,
  ColumnVisibility,
  AdminLayout,
  DataTable,
  FilterBar,
  Head,
  Link,
  ListCards,
  ListToolbar,
  MobileListControls,
  PageHeader,
  Pagination,
  RowActionsMenu,
  Slot,
  COMPACT_QUERY,
  PHONE_QUERY,
  useActions,
  useMediaQuery,
  type ResourceIndexPageProps,
} from '@mezielabs/azu-react'
import type { ActionSchema, ListRow } from '@mezielabs/azu/types'

/**
 * The resource list (FR-05). Every change (page, size, sort, search,
 * filters) is a URL change through an Inertia partial reload of
 * `list`, so the state survives reload, a filtered view can be
 * bookmarked, and the server does all the work.
 *
 * Row actions sit in each row's menu, and bulk actions in a toolbar
 * over the selection (FR-12). After one runs, the list reloads, the
 * selection clears and focus moves to the table (docs/ui-check.md §3).
 * With every row on the page selected, "Select all N matching" widens
 * the selection to every row the search and filters match (FR-17); the
 * server runs the action on those in chunks.
 */
export default function ResourceIndex({ azu, resource, list, abilities }: ResourceIndexPageProps) {
  const [selected, setSelected] = useState<(string | number)[]>([])
  // Every matching row, past this page (FR-17). A narrower selection,
  // or another page, search or filter, ends it
  const [allMatching, setAllMatching] = useState(false)
  const [cleared, setCleared] = useState(0)
  const table = useRef<HTMLElement>(null)
  const path = `${azu.path}/resources/${resource.name}`
  const [columnChoice, setColumnChoice] = useState<{ path: string; names: string[] } | null>(null)
  const columns = useMemo(
    () =>
      visibleListColumns(resource.columns, columnChoice?.path === path ? columnChoice.names : null),
    [resource.columns, columnChoice, path]
  )
  const slot = { resource, page: 'index', record: null, path } as const

  const actions = useActions({
    path: azu.path,
    resource,
    timezone: azu.timezone,
    onDone: (result) => {
      if (result.redirect) return router.visit(result.redirect)
      setCleared((count) => count + 1)
      router.reload({
        only: ['list'],
        onFinish: () =>
          table.current?.querySelector<HTMLElement>('[role="grid"], .azu-list-cards')?.focus(),
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
  useEffect(() => setAllMatching(false), [list.state])
  const current = requested ?? list.state

  function go(change: Partial<ListState>, replace = false) {
    const next = nextListState(current, change)
    setRequested(next)
    const url = listStateUrl(path, next, { defaultPerPage: list.defaultPerPage })
    router.get(url, {}, { only: ['list'], preserveState: true, preserveScroll: true, replace })
  }

  const count = new Intl.NumberFormat('en')
  const noun = { one: resource.singularLabel.toLowerCase(), many: resource.label.toLowerCase() }
  const rowHref = (row: ListRow) =>
    row.abilities.view ? `${path}/${encodeURIComponent(String(row.id))}` : undefined
  // Each row's menu: View and Edit when the server allows them for that
  // row, then its row actions. No menu when none of those is allowed
  const rowMenu = (row: ListRow, className?: string) => (
    <RowActionsMenu
      actions={rowActions.filter((action) => row.abilities.actions.includes(actionKey(action)))}
      title={row.title ?? String(row.id)}
      viewHref={rowHref(row)}
      editHref={
        row.abilities.update ? `${path}/${encodeURIComponent(String(row.id))}/edit` : undefined
      }
      className={className}
      onAction={(action) =>
        actions.run(action, { ids: [row.id] }, row.title ?? `${resource.singularLabel} ${row.id}`)
      }
    />
  )
  const selecting = selected.length > 0
  const offerAll =
    !allMatching &&
    bulkActions.length > 0 &&
    offersAllMatching(selected.length, list.rows.length, list.meta.total)
  const phone = useMediaQuery(PHONE_QUERY)
  const [selectingCards, setSelectingCards] = useState(false)
  useEffect(() => {
    setSelected([])
    setAllMatching(false)
    setSelectingCards(false)
  }, [list.rows, cleared, phone])
  function selectCard(id: string | number, checked: boolean) {
    setSelected((ids) =>
      checked ? [...ids.filter((item) => item !== id), id] : ids.filter((item) => item !== id)
    )
    setAllMatching(false)
  }
  // The bar keeps one line: some actions in a menu, all of them below 1024px
  const compact = useMediaQuery(COMPACT_QUERY)
  const arranged = splitActions(bulkActions, { narrow: compact })
  function runBulk(action: ActionSchema) {
    actions.run(
      action,
      allMatching
        ? {
            matching: {
              search: list.state.search,
              filters: list.state.filters,
              count: list.meta.total,
            },
          }
        : { ids: selected }
    )
  }

  // An empty list says why, and offers to clear what's narrowing it
  const empty = emptyListMessage({
    noun,
    filters: list.filters,
    values: list.state.filters,
    search: list.state.search,
  })
  const emptyState = (
    <>
      <p className="azu-empty-message">{empty.message}</p>
      {empty.clear && (
        <button
          type="button"
          className="azu-button"
          onClick={() => go({ search: '', filters: {} })}
        >
          Clear {empty.clear}
        </button>
      )}
    </>
  )

  return (
    <AdminLayout azu={azu} title={resource.label}>
      <Head title={resource.label} />
      <PageHeader
        page="resource/index"
        resource={resource.name}
        title={
          <>
            {resource.label}
            <span className="azu-title-count">
              <span className="azu-visually-hidden">, </span>
              {count.format(list.meta.unfilteredTotal ?? list.meta.total)}
            </span>
          </>
        }
        breadcrumbs={resourceBreadcrumbs(resource, path, { list: false })}
        actions={
          <>
            <Slot name="toolbar" {...slot} />
            <ColumnVisibility
              columns={resource.columns}
              visible={columns.map((column) => column.name)}
              onChange={(names) => setColumnChoice(names === null ? null : { path, names })}
            />
            {abilities.create && (
              <Link
                href={`${path}/create`}
                className="azu-button azu-button-primary azu-new-button"
              >
                <span className="azu-new-icon" aria-hidden="true">
                  +
                </span>
                <span className="azu-new-label">New {resource.singularLabel.toLowerCase()}</span>
              </Link>
            )}
          </>
        }
      />
      <Slot name="header" {...slot} />
      <Slot name="beforeTable" {...slot} />
      <section ref={table} className="azu-list" aria-label={resource.label}>
        {/* Always rendered, so a change in the selection is announced */}
        <p className="azu-visually-hidden" role="status" data-azu-selection-status>
          {selectionSummary(selected.length, allMatching ? list.meta.total : null)}
        </p>
        {/*
          The selection's bar takes the controls' place at the same
          height, so the table doesn't move
        */}
        {selecting ? (
          <div className="azu-list-bar azu-bulk-bar" role="toolbar" aria-label="Bulk actions">
            <span className="azu-bulk-count">
              {selectionSummary(selected.length, allMatching ? list.meta.total : null)}
            </span>
            {offerAll && (
              <button type="button" className="azu-bulk-link" onClick={() => setAllMatching(true)}>
                Select all {count.format(list.meta.total)} matching
              </button>
            )}
            <button
              type="button"
              className="azu-bulk-link azu-bulk-clear"
              onClick={() => setCleared((cleared) => cleared + 1)}
            >
              Clear selection
            </button>
            <span className="azu-bulk-spacer" />
            {arranged.buttons.map((action) => (
              <button
                key={action.name}
                type="button"
                className="azu-bulk-action"
                data-azu-destructive={action.destructive || undefined}
                disabled={actions.busy}
                onClick={() => runBulk(action)}
              >
                {action.label}
              </button>
            ))}
            {arranged.menuLabel && (
              <ActionsMenu
                actions={arranged.menu}
                label={arranged.menuLabel}
                className="azu-bulk-action azu-bulk-menu"
                isDisabled={actions.busy}
                onAction={runBulk}
              />
            )}
          </div>
        ) : (
          <div className="azu-list-bar azu-list-controls">
            <ListToolbar
              state={current}
              label={resource.label}
              searchable={resource.search.length > 0}
              onSearch={(search) => go({ search }, true)}
            />
            <FilterBar
              filters={list.filters}
              values={current.filters}
              label={resource.label}
              onChange={(filters) => go({ filters })}
            />
          </div>
        )}
        {phone && (
          <MobileListControls
            columns={resource.columns}
            state={current}
            canSelect={
              bulkActionsFor(
                resource.actions,
                list.rows,
                list.rows.map((row) => row.id)
              ).length > 0
            }
            selecting={selectingCards}
            onSort={(sort, direction) => go({ sort, direction })}
            onSelect={() => setSelectingCards(true)}
            onSelectPage={() => {
              setSelected(list.rows.map((row) => row.id))
              setAllMatching(false)
            }}
            onDone={() => {
              setSelectingCards(false)
              setSelected([])
              setAllMatching(false)
            }}
          />
        )}
        {/* One or the other, so each row is in the page once */}
        {phone ? (
          <ListCards
            label={resource.label}
            columns={columns}
            showAllDetails
            titleColumn={resource.title}
            rows={list.rows}
            timezone={azu.timezone}
            rowHref={rowHref}
            selection={selectingCards ? { ids: selected, onChange: selectCard } : undefined}
            rowMenu={(row) => rowMenu(row, 'azu-icon-button azu-touch azu-card-menu')}
            emptyState={emptyState}
          />
        ) : (
          <div className="azu-list-table">
            <DataTable
              label={resource.label}
              columns={columns}
              titleColumn={resource.title}
              rows={list.rows}
              state={list.state}
              timezone={azu.timezone}
              onSort={(sort, direction) => go({ sort, direction })}
              onSelectionChange={(ids) => {
                setSelected(ids)
                if (ids.length < list.rows.length) setAllMatching(false)
              }}
              rowHref={rowHref}
              clearSelection={cleared}
              rowActions={(row) => rowMenu(row)}
              emptyState={emptyState}
            />
          </div>
        )}
        <Pagination
          meta={list.meta}
          onPage={(page) => go({ page })}
          onPerPage={(perPage) => go({ perPage })}
        />
      </section>
      {actions.dialog}
    </AdminLayout>
  )
}
