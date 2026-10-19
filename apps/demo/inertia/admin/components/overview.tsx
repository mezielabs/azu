import { Link, type ScreenProps } from '@mezielabs/azu-react'
import { formatDecimal } from '@mezielabs/azu/shared'
import type overview from '#admin/screens/overview'

const number = new Intl.NumberFormat('en')

/**
 * The demo's home screen: each count links to the list it counts.
 */
export default function Overview({ data }: ScreenProps<typeof overview>) {
  const cards = [
    {
      label: 'Orders today',
      value: number.format(data.ordersToday.count),
      href: data.ordersToday.href,
      action: 'See them',
    },
    {
      label: `Revenue in ${data.revenueThisMonth.month}`,
      value: formatDecimal(data.revenueThisMonth.total, { style: 'currency', currency: 'NGN' }),
      href: data.revenueThisMonth.href,
      action: 'See the orders',
    },
    {
      label: 'Products low on stock',
      value: number.format(data.lowStock.count),
      href: data.lowStock.href,
      action: 'See them',
    },
  ]

  return (
    <ul
      aria-label="Store at a glance"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 14rem), 1fr))',
        gap: 16,
        margin: 0,
        padding: 0,
        listStyle: 'none',
      }}
    >
      {cards.map((card) => (
        <li key={card.label} className="azu-panel">
          <h2 className="azu-panel-title">{card.label}</h2>
          <div style={{ display: 'grid', gap: 8, padding: '16px 20px 18px' }}>
            <p
              style={{
                margin: 0,
                fontSize: 28,
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {card.value}
            </p>
            <Link href={card.href} style={{ color: 'var(--azu-brand)', fontWeight: 500 }}>
              {card.action}
              <span className="azu-visually-hidden">: {card.label.toLowerCase()}</span>
            </Link>
          </div>
        </li>
      ))}
    </ul>
  )
}
