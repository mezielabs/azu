import { Suspense } from 'react'
import {
  AdminLayout,
  Head,
  PageHeader,
  useComponent,
  type ScreenPageProps,
} from '@mezielabs/azu-react'

/**
 * A custom screen (FR-20): the shell, a breadcrumb (its group, then its
 * label), a header with the label, then the app's component with
 * `{ data, screen }`. A component no file registers shows an error that
 * names it, rather than a blank page.
 */
export default function ScreenPage({ azu, screen, data }: ScreenPageProps) {
  const Component = useComponent(screen.component)
  const breadcrumbs = [...(screen.group ? [{ label: screen.group }] : []), { label: screen.label }]

  return (
    <AdminLayout azu={azu} title={screen.label}>
      <Head title={screen.label} />
      <PageHeader
        page="screen"
        resource={screen.name}
        title={screen.label}
        breadcrumbs={breadcrumbs}
      />
      <div className="azu-screen" data-azu-screen={screen.name}>
        {Component ? (
          <Suspense fallback={<div className="azu-slot-loading" aria-busy="true" />}>
            <Component data={data} screen={screen} />
          </Suspense>
        ) : (
          <div className="azu-form-errors" role="alert">
            <p>
              The {screen.label} screen uses the {screen.component} component, but no file in
              inertia/admin/components registers it. Add{' '}
              <code>inertia/admin/components/{componentFile(screen.component)}.tsx</code>.
            </p>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

/** `SalesReport` → `sales_report`, the file that registers it */
function componentFile(name: string) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
}
