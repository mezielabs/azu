import { router } from '@inertiajs/react'
import { actionKey, detailLayout, formatDateTime, resourceBreadcrumbs } from '@mezielabs/azu/shared'
import {
  AdminLayout,
  FieldValueView,
  Head,
  Link,
  ListCell,
  PageHeader,
  RelationTableView,
  RowActionsMenu,
  Slot,
  useActions,
  type ResourceShowPageProps,
} from '@mezielabs/azu-react'
import type { FileValue, ListRow } from '@mezielabs/azu/types'

/**
 * The detail page (FR-06, layout 3/4), read-only. Two columns: the
 * fields on the left, formatted like the list's columns; images, files
 * and the record's ID and timestamps on the right; `hasMany` tables
 * below. With no fields to show, it shows the columns instead.
 *
 * Row actions are buttons in the header, except destructive ones
 * (Delete), which sit in a "⋯" menu. The server checks the policy's
 * `view`; Edit shows only when `update` allows it, and the server checks
 * that again.
 */
export default function ResourceShow({
  azu,
  resource,
  fields,
  record,
  timestamps,
  cells,
  relations,
  abilities,
}: ResourceShowPageProps) {
  const path = `${azu.path}/resources/${resource.name}`
  const name = record.title ?? `${resource.singularLabel} ${record.id}`
  const detail = `${path}/${encodeURIComponent(String(record.id))}`
  const slot = {
    resource,
    page: 'show',
    record: { id: record.id, title: record.title },
    path,
  } as const

  const actions = useActions({
    path: azu.path,
    resource,
    timezone: azu.timezone,
    onDone: (result, action) => {
      if (result.redirect) return router.visit(result.redirect)
      // A deleted record has no detail page left
      if (action.name === 'delete') return router.visit(path)
      router.reload()
    },
  })
  const rowActions = resource.actions.filter(
    (action) => action.kind === 'row' && abilities.actions.includes(actionKey(action))
  )
  const buttons = rowActions.filter((action) => !action.destructive)
  const menu = rowActions.filter((action) => action.destructive)

  const layout = detailLayout(fields, resource.columns)
  // The row the list would have, for column cells (the fallback, the badge)
  const row: ListRow = {
    id: record.id,
    title: record.title,
    cells: cells ?? {},
    abilities: { view: true, update: abilities.update, actions: abilities.actions },
  }
  const badgeValue = layout.badge
    ? (record.values[layout.badge.name] ?? cells?.[layout.badge.name] ?? null)
    : null
  const columnFor = (fieldName: string) =>
    resource.columns.find((column) => column.name === fieldName)
  const when = (iso: string) => formatDateTime(iso, { timezone: azu.timezone })

  return (
    <AdminLayout azu={azu} title={resource.label}>
      <Head title={name} />
      <PageHeader
        page="resource/show"
        resource={resource.name}
        title={
          <>
            {name}
            {layout.badge && badgeValue !== null && (
              <span className="azu-title-badge">
                <ListCell
                  column={layout.badge}
                  value={badgeValue as string}
                  row={row}
                  timezone={azu.timezone}
                />
              </span>
            )}
          </>
        }
        breadcrumbs={resourceBreadcrumbs(resource, path)}
        actions={
          <>
            <Slot name="toolbar" {...slot} />
            {buttons.map((action) => (
              <button
                key={action.name}
                type="button"
                className="azu-button"
                disabled={actions.busy}
                onClick={() => actions.run(action, { ids: [record.id] })}
              >
                {action.label}
              </button>
            ))}
            {abilities.update && (
              <Link href={`${detail}/edit`} className="azu-button azu-button-primary">
                Edit
              </Link>
            )}
            <RowActionsMenu
              actions={menu}
              title={name}
              label="More actions"
              className="azu-button azu-more-button"
              onAction={(action) => actions.run(action, { ids: [record.id] })}
            />
          </>
        }
      />
      <Slot name="header" {...slot} />
      {actions.dialog}
      <div className="azu-detail-grid">
        <section className="azu-panel azu-detail-main" aria-labelledby="azu-details-title">
          <h2 id="azu-details-title" className="azu-panel-title">
            Details
          </h2>
          <dl className="azu-details">
            {cells
              ? resource.columns
                  .filter((column) => !column.hiddenByDefault && column !== layout.badge)
                  .map((column) => (
                    <div key={column.name} className="azu-detail" data-azu-column={column.name}>
                      <dt className="azu-detail-label">{column.label}</dt>
                      <dd className="azu-detail-value">
                        <ListCell
                          column={column}
                          value={cells[column.name] ?? null}
                          row={row}
                          timezone={azu.timezone}
                        />
                      </dd>
                    </div>
                  ))
              : layout.main.map((field) => (
                  <div key={field.name} className="azu-detail" data-azu-field={field.name}>
                    <dt className="azu-detail-label">{field.label}</dt>
                    <dd className="azu-detail-value">
                      <FieldValueView
                        field={field}
                        value={record.values[field.name] ?? null}
                        timezone={azu.timezone}
                        column={columnFor(field.name)}
                      />
                    </dd>
                  </div>
                ))}
          </dl>
        </section>
        <div className="azu-detail-side">
          {layout.media.map((field) => {
            const file = (record.values[field.name] ?? null) as FileValue | null
            return (
              <section
                key={field.name}
                className="azu-panel azu-media-card"
                data-azu-field={field.name}
                aria-labelledby={`azu-media-${field.name}`}
              >
                <h2 id={`azu-media-${field.name}`} className="azu-panel-title">
                  {field.label}
                </h2>
                {!file ? (
                  <p className="azu-cell-empty">None</p>
                ) : field.kind === 'image' && file.url ? (
                  <>
                    <a href={file.url} target="_blank" rel="noopener noreferrer">
                      <img
                        className="azu-media-image"
                        src={file.url}
                        alt={`${field.label}: ${file.name}`}
                      />
                    </a>
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="azu-media-link"
                    >
                      {file.name} · Open full size
                    </a>
                  </>
                ) : (
                  <FieldValueView field={field} value={file} timezone={azu.timezone} />
                )}
              </section>
            )
          })}
          <section className="azu-panel azu-record-card" aria-labelledby="azu-record-title">
            <h2 id="azu-record-title" className="azu-panel-title">
              Record
            </h2>
            <dl className="azu-record-facts">
              <div>
                <dt>ID</dt>
                <dd className="azu-mono">{String(record.id)}</dd>
              </div>
              {timestamps.createdAt && (
                <div>
                  <dt>Created</dt>
                  <dd>
                    <time dateTime={timestamps.createdAt}>{when(timestamps.createdAt)}</time>
                  </dd>
                </div>
              )}
              {timestamps.updatedAt && (
                <div>
                  <dt>Updated</dt>
                  <dd>
                    <time dateTime={timestamps.updatedAt}>{when(timestamps.updatedAt)}</time>
                  </dd>
                </div>
              )}
            </dl>
          </section>
        </div>
      </div>
      {relations.map((table) => (
        <RelationTableView key={table.name} table={table} path={azu.path} timezone={azu.timezone} />
      ))}
    </AdminLayout>
  )
}
