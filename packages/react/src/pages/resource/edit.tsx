import {
  AdminLayout,
  Head,
  PageHeader,
  ResourceForm,
  Slot,
  type ResourceEditPageProps,
} from '@mezielabs/azu-react'
import { resourceBreadcrumbs } from '@mezielabs/azu/shared'

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
  const slot = { resource, page: 'edit', record, path } as const

  return (
    <AdminLayout azu={azu} title={resource.label}>
      <div className="azu-form-page">
        <Head title={`Edit ${name}`} />
        <PageHeader
          page="resource/edit"
          resource={resource.name}
          title={`Edit ${name}`}
          breadcrumbs={resourceBreadcrumbs(resource, path, {
            trail: [{ label: name, href: detail }],
          })}
          actions={<Slot name="toolbar" {...slot} />}
        />
        <Slot name="header" {...slot} />
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
        <Slot name="afterForm" {...slot} />
      </div>
    </AdminLayout>
  )
}
