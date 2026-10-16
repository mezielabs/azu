// inertia/admin/components/stock_bar.tsx
import type { CellProps } from '@mezielabs/azu-react'

export default function StockBar({ value }: CellProps<number>) {
  const stock = value ?? 0
  return (
    <span style={{ color: stock < 10 ? 'var(--azu-danger)' : undefined }}>{stock} in stock</span>
  )
}
