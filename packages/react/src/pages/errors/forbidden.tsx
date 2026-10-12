import { AdminLayout, Head, type ForbiddenPageProps } from '@mezielabs/azu-react'

/**
 * Shown with a 403 to signed-in users who fail the app's accessAdmin
 * ability. It says nothing about why, which the server logs instead.
 */
export default function Forbidden({ azu }: ForbiddenPageProps) {
  return (
    <AdminLayout azu={azu} title="No access">
      <Head title="No access" />
      <h1 className="azu-page-title" data-azu-page="errors/forbidden">
        You don&apos;t have access to the admin panel
      </h1>
      <div className="azu-empty">
        <p>Ask an administrator if you think you should.</p>
      </div>
    </AdminLayout>
  )
}
