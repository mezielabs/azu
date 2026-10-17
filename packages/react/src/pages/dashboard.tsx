import { AdminLayout, Head, PageHeader, type DashboardPageProps } from '@mezielabs/azu-react'

export default function Dashboard({ azu }: DashboardPageProps) {
  return (
    <AdminLayout azu={azu} title="Dashboard">
      <Head title="Dashboard" />
      <PageHeader page="dashboard" title="Dashboard" />
      <div className="azu-empty">
        <p>Azu is installed.</p>
        <p>
          {azu.navigation.length > 0
            ? 'Pick a resource from the navigation.'
            : 'Resources you add in app/admin/resources will show up here.'}
        </p>
      </div>
    </AdminLayout>
  )
}
