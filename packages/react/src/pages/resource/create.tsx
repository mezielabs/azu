import {
  AdminLayout,
  Head,
  Link,
  ResourceForm,
  Slot,
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
  const slot = { resource, page: 'create', record: null, path } as const

  return (
    <AdminLayout azu={azu} title={resource.label}>
      <Head title={title} />
      <nav className="azu-breadcrumbs" aria-label="Breadcrumbs">
        <Link href={path}>{resource.label}</Link>
      </nav>
      <div className="azu-page-header">
        <h1
          className="azu-page-title"
          data-azu-page="resource/create"
          data-azu-resource={resource.name}
        >
          {title}
        </h1>
        <div className="azu-toolbar">
          <Slot name="toolbar" {...slot} />
        </div>
      </div>
      <Slot name="header" {...slot} />
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
      <Slot name="afterForm" {...slot} />
    </AdminLayout>
  )
}
