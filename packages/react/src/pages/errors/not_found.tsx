import { AdminLayout, Head, type NotFoundPageProps } from '@mezielabs/azu-react'

export default function NotFound({ azu }: NotFoundPageProps) {
  return (
    <AdminLayout azu={azu} title="Not found">
      <Head title="Not found" />
      <h1 className="azu-page-title" data-azu-page="errors/not_found">
        This page doesn&apos;t exist
      </h1>
    </AdminLayout>
  )
}
