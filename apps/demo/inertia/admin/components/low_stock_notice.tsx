// inertia/admin/components/low_stock_notice.tsx
import { Link, type SlotProps } from '@mezielabs/azu-react'

export default function LowStockNotice({ path }: SlotProps) {
  return (
    <p>
      Running low?{' '}
      <Link href={`${path}?low-stock=1`}>Show products with fewer than 10 in stock</Link>
    </p>
  )
}
