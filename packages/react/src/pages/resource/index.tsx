import { AdminLayout, Head, type ResourceIndexPageProps } from '@mezielabs/azu-react'

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`

/**
 * The resource list. FR-03 renders a placeholder from the schema; the
 * list itself (records, sorting, search, pagination) arrives with FR-05.
 */
export default function ResourceIndex({ azu, resource }: ResourceIndexPageProps) {
  return (
    <AdminLayout azu={azu} title={resource.label}>
      <Head title={resource.label} />
      <h1
        className="azu-page-title"
        data-azu-page="resource/index"
        data-azu-resource={resource.name}
      >
        {resource.label}
      </h1>
      <div className="azu-empty">
        <p>The {resource.singularLabel.toLowerCase()} list arrives with FR-05.</p>
        <p>
          {count(resource.columns.length, 'column')}, {count(resource.fields.length, 'field')},{' '}
          {count(resource.filters.length, 'filter')} and {count(resource.actions.length, 'action')}{' '}
          are defined.
        </p>
      </div>
    </AdminLayout>
  )
}
