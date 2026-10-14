import {
  AdminLayout,
  Head,
  Link,
  ResourceForm,
  type ResourceEditPageProps,
} from '@mezielabs/azu-react'

/**
 * The edit form (FR-06). The server checks the policy's `update` for
 * the page and again for the submit.
 */
export default function ResourceEdit({
  azu,
  resource,
  record,
  form,
  errors,
}: ResourceEditPageProps) {
  const path = `${azu.path}/resources/${resource.name}`
  const name = record.title ?? `${resource.singularLabel} ${record.id}`
  const detail = `${path}/${encodeURIComponent(String(record.id))}`

  return (
    <AdminLayout azu={azu} title={resource.label}>
      <Head title={`Edit ${name}`} />
      <nav className="azu-breadcrumbs" aria-label="Breadcrumbs">
        <Link href={path}>{resource.label}</Link>
        <span aria-hidden> / </span>
        <Link href={detail}>{name}</Link>
      </nav>
      <h1
        className="azu-page-title"
        data-azu-page="resource/edit"
        data-azu-resource={resource.name}
      >
        Edit {name}
      </h1>
      <ResourceForm
        form={form}
        errors={errors}
        action={`${detail}/edit`}
        method="put"
        timezone={azu.timezone}
        submitLabel="Save changes"
        cancelHref={detail}
        successMessage={`${resource.singularLabel} saved`}
      />
    </AdminLayout>
  )
}
