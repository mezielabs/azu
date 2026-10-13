import {
  AdminLayout,
  FieldValueView,
  Head,
  Link,
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
  abilities,
}: ResourceShowPageProps) {
  const path = `${azu.path}/resources/${resource.name}`
  const name = record.title ?? `${resource.singularLabel} ${record.id}`
  const detail = `${path}/${encodeURIComponent(String(record.id))}`

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
        {abilities.update && (
          <Link href={`${detail}/edit`} className="azu-button azu-button-primary">
            Edit
          </Link>
        )}
      </div>
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
    </AdminLayout>
  )
}
