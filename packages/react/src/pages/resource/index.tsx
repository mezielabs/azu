import { AdminLayout, Head, useComponent } from '@mezielabs/azu-react'

type Column = { name: string; kind: string; component?: string }
type Props = {
  resource: { name: string; label: string }
  columns: Column[]
  rows: Record<string, unknown>[]
}

function Cell({ column, row }: { column: Column; row: Record<string, unknown> }) {
  const Custom = useComponent(column.component)
  const value = row[column.name]
  if (Custom) return <Custom value={value} record={row} />
  if (column.kind === 'belongsTo') {
    const related = value as Record<string, unknown> | null
    return <>{related ? String(related.name ?? related.id) : '—'}</>
  }
  return <>{value === null || value === undefined ? '—' : String(value)}</>
}

export default function ResourceIndex({ resource, columns, rows }: Props) {
  return (
    <AdminLayout title={resource.label}>
      <Head title={resource.label} />
      <h1 className="mb-4 text-2xl font-semibold" data-azu-page="package-resource-index">
        {resource.label}
      </h1>
      <div className="overflow-x-auto rounded-lg border border-azu-border">
        <table className="min-w-full text-sm">
          <thead className="bg-azu-subtle text-left">
            <tr>
              {columns.map((column) => (
                <th key={column.name} className="px-3 py-2 font-medium">
                  {column.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={String(row.id)} className="border-t border-azu-border">
                {columns.map((column) => (
                  <td key={column.name} className="px-3 py-2">
                    <Cell column={column} row={row} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  )
}
