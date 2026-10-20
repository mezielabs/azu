import { Suspense } from 'react'
import {
  AdminLayout,
  Head,
  PageHeader,
  RangeSwitch,
  ScreenForm,
  ScreenWidgets,
  useComponent,
  type ScreenPageProps,
} from '@mezielabs/azu-react'
import { rangeSummary, screenBreadcrumbs } from '@mezielabs/azu/shared'

/**
 * A custom screen (FR-20): the shell, a breadcrumb (its group, then its
 * label; none without a group), a header with the label, then the app's
 * component with `{ data, screen }`. A component no file registers shows an error that
 * names it, rather than a blank page.
 *
 * A form screen (FR-23) renders Azu's form instead, laid out as the
 * resource forms are, with a single "Save changes" button. It submits
 * to the screen's own URL.
 *
 * A widgets screen (FR-24) renders its widgets, with the range under
 * the title and the range switch beside it.
 */
export default function ScreenPage({
  azu,
  screen,
  data,
  form,
  errors,
  widgets,
  range,
  ranges,
}: ScreenPageProps) {
  const Component = useComponent(screen.component ?? undefined)
  const breadcrumbs = screenBreadcrumbs(screen)

  if (widgets && range) {
    return (
      <AdminLayout azu={azu} title={screen.label}>
        <Head title={screen.label} />
        <PageHeader
          page="screen"
          resource={screen.name}
          title={screen.label}
          breadcrumbs={breadcrumbs}
          description={rangeSummary(range, {
            compared: widgets.some((widget) => widget.compares),
          })}
          actions={
            <RangeSwitch
              ranges={ranges}
              current={range.name}
              widgets={widgets.map((widget) => widget.key)}
            />
          }
        />
        <ScreenWidgets azu={azu} screen={screen} widgets={widgets} />
      </AdminLayout>
    )
  }

  if (form) {
    return (
      <AdminLayout azu={azu} title={screen.label}>
        <div className="azu-form-page" data-azu-screen={screen.name}>
          <Head title={screen.label} />
          <PageHeader
            page="screen"
            resource={screen.name}
            title={screen.label}
            breadcrumbs={breadcrumbs}
          />
          <ScreenForm azu={azu} screen={screen} form={form} errors={errors} />
        </div>
      </AdminLayout>
    )
  }

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
              <code>inertia/admin/components/{componentFile(screen.component ?? '')}.tsx</code>.
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
