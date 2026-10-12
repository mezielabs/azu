/**
 * SPIKE: a published page. Copied unchanged from
 * packages/react/src/pages/dashboard.tsx, then edited. Azu renders this
 * copy instead of the package's.
 */
import { AdminLayout, Head, Link } from '@mezielabs/azu-react'

type Props = { resources: { name: string; label: string }[] }

export default function Dashboard({ resources }: Props) {
  return (
    <AdminLayout title="Dashboard">
      <Head title="Dashboard" />
      <h1 className="mb-4 text-2xl font-semibold" data-azu-page="app-dashboard">
        Demo store admin
      </h1>
      <ul className="space-y-2">
        {resources.map((resource) => (
          <li key={resource.name}>
            <Link className="text-azu-brand underline" href={`/admin/resources/${resource.name}`}>
              {resource.label}
            </Link>
          </li>
        ))}
      </ul>
    </AdminLayout>
  )
}
