// Published from @mezielabs/azu-react 0.0.0 by `node ace azu:publish dashboard`.
// Azu renders this file instead of its own page, so it's yours to edit. After
// upgrading Azu, run `node ace azu:doctor` to see whether the original changed.
// azu-publish: dashboard@0.0.0 sha256:65b17365621ce8bc49a5052b1ccd28494e66622d85d19dc2342d0295d62f153d
import { AdminLayout, Head, Link, PageHeader, type DashboardPageProps } from '@mezielabs/azu-react'

export default function Dashboard({ azu }: DashboardPageProps) {
  return (
    <AdminLayout azu={azu} title="Dashboard">
      <Head title="Dashboard" />
      <PageHeader page="dashboard" title="Dashboard" />
      {/* The demo's edit to the published page (FR-15) */}
      <div className="azu-empty" data-demo="dashboard">
        <p>Welcome to the Azu demo store.</p>
        <p>
          Pick a resource from the navigation, or start with the{' '}
          <Link href={`${azu.path}/resources/products?low-stock=1`}>products low on stock</Link>.
        </p>
      </div>
    </AdminLayout>
  )
}
