// inertia/admin/components/print_order.tsx
import type { SlotProps } from '@mezielabs/azu-react'

export default function PrintOrder({ page }: SlotProps) {
  // The toolbar slot is on every Orders page; printing is for one order
  if (page !== 'show') return null

  return (
    <button type="button" className="azu-button" onClick={() => window.print()}>
      Print
    </button>
  )
}
