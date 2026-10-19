// inertia/admin/components/low_stock_notice.tsx
import { Link, type SlotProps } from '@mezielabs/azu-react'

/**
 * Amber in both themes: Azu's yellow badge colours
 */
const notice = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  marginBottom: 16,
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid color-mix(in srgb, var(--azu-badge-yellow-text) 25%, transparent)',
  background: 'var(--azu-badge-yellow-bg)',
  color: 'var(--azu-badge-yellow-text)',
  fontSize: 14,
  textDecoration: 'none',
}

export default function LowStockNotice({ path, data }: SlotProps<{ count: number }>) {
  // The resource's `data` function counts them on the server
  const count = data?.count ?? 0
  if (count === 0) return null

  return (
    <Link href={`${path}?low-stock=1`} style={notice}>
      <svg
        aria-hidden="true"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      </svg>
      <span style={{ flexGrow: 1 }}>
        <strong>
          {count} {count === 1 ? 'product has' : 'products have'}
        </strong>{' '}
        fewer than 10 in stock.
      </span>
      <span style={{ fontWeight: 600, textDecoration: 'underline' }}>Show them</span>
    </Link>
  )
}
