import {
  AdminLayout,
  Head,
  Link,
  ResourceForm,
  type ResourceCreatePageProps,
} from '@mezielabs/azu-react'

/**
 * The create form (FR-06). The server checks the policy's `create` for
 * the page and again for the submit.
 */
export default function ResourceCreate({ azu, resource, form, errors }: ResourceCreatePageProps) {
  const path = `${azu.path}/resources/${resource.name}`
  const singular = resource.singularLabel.toLowerCase()
  const title = `New ${singular}`

  return (
    <AdminLayout azu={azu} title={resource.label}>
      <Head title={title} />
      <nav className="azu-breadcrumbs" aria-label="Breadcrumbs">
        <Link href={path}>{resource.label}</Link>
      </nav>
      <h1
        className="azu-page-title"
        data-azu-page="resource/create"
        data-azu-resource={resource.name}
      >
        {title}
      </h1>
      <ResourceForm
        form={form}
        errors={errors}
        action={`${path}/create`}
        method="post"
        timezone={azu.timezone}
        submitLabel={`Create ${singular}`}
        cancelHref={path}
        successMessage={`${resource.singularLabel} created`}
      />
    </AdminLayout>
  )
}
