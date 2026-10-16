import { router } from '@inertiajs/react'
import { actionKey } from '@mezielabs/azu/shared'
import {
  AdminLayout,
  FieldValueView,
  Head,
  Link,
  RelationTableView,
  useActions,
  type ResourceShowPageProps,
} from '@mezielabs/azu-react'

/**
 * The detail page (FR-06): the record's fields, read-only. The server
 * checks the policy's `view`; Edit shows only when `update` allows it,
 * and the server checks that again.
 */
export default function ResourceShow({
  azu,
  resource,
  fields,
  record,
  relations,
  abilities,
}: ResourceShowPageProps) {
  const path = `${azu.path}/resources/${resource.name}`
  const name = record.title ?? `${resource.singularLabel} ${record.id}`
  const detail = `${path}/${encodeURIComponent(String(record.id))}`

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

  return (
    <AdminLayout azu={azu} title={resource.label}>
      <Head title={name} />
      <nav className="azu-breadcrumbs" aria-label="Breadcrumbs">
        <Link href={path}>{resource.label}</Link>
      </nav>
      <div className="azu-page-header">
        <h1
          className="azu-page-title"
          data-azu-page="resource/show"
          data-azu-resource={resource.name}
        >
          {name}
        </h1>
        <div className="azu-toolbar">
          {rowActions.map((action) => (
            <button
              key={action.name}
              type="button"
              className={`azu-button ${action.destructive ? 'azu-button-danger' : ''}`}
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
        </div>
      </div>
      {actions.dialog}
      <dl className="azu-details">
        {fields.map((field) => (
          <div key={field.name} className="azu-detail" data-azu-field={field.name}>
            <dt className="azu-detail-label">{field.label}</dt>
            <dd className="azu-detail-value">
              <FieldValueView
                field={field}
                value={record.values[field.name] ?? null}
                timezone={azu.timezone}
              />
            </dd>
          </div>
        ))}
      </dl>
      {relations.map((table) => (
        <RelationTableView key={table.name} table={table} path={azu.path} timezone={azu.timezone} />
      ))}
    </AdminLayout>
  )
}
