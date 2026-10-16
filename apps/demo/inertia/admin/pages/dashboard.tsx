// Published from @mezielabs/azu-react 0.0.0 by `node ace admin:publish dashboard`.
// Azu renders this file instead of its own page, so it's yours to edit. After
// upgrading Azu, run `node ace admin:doctor` to see whether the original changed.
// azu-publish: dashboard@0.0.0 sha256:46096d4270e53b2ece14531bddbe200e8f7302e2453dd7b63cd971dcdf72e0e7
import { AdminLayout, Head, Link, type DashboardPageProps } from '@mezielabs/azu-react'

export default function Dashboard({ azu }: DashboardPageProps) {
  return (
    <AdminLayout azu={azu} title="Dashboard">
      <Head title="Dashboard" />
      <h1 className="azu-page-title" data-azu-page="dashboard">
        Dashboard
      </h1>
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
