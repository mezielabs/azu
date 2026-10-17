import {
  AdminLayout,
  Head,
  PageHeader,
  ResourceForm,
  Slot,
  type ResourceCreatePageProps,
} from '@mezielabs/azu-react'
import { resourceBreadcrumbs } from '@mezielabs/azu/shared'

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
      <PageHeader
        page="resource/create"
        resource={resource.name}
        title={title}
        breadcrumbs={resourceBreadcrumbs(resource, path)}
        actions={<Slot name="toolbar" {...slot} />}
      />
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
