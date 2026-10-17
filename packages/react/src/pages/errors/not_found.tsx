import { AdminLayout, Head, PageHeader, type NotFoundPageProps } from '@mezielabs/azu-react'

export default function NotFound({ azu }: NotFoundPageProps) {
  return (
    <AdminLayout azu={azu} title="Not found">
      <Head title="Not found" />
      <PageHeader page="errors/not_found" title={<>This page doesn&apos;t exist</>} />
    </AdminLayout>
  )
}
