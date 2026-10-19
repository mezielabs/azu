import { router } from '@inertiajs/react'
import type { ScreenProps } from '@mezielabs/azu-react'
import { formatDecimal } from '@mezielabs/azu/shared'
import type salesReport from '#admin/screens/sales_report'

const naira = (value: string) => formatDecimal(value, { style: 'currency', currency: 'NGN' })
const day = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})

/**
 * Orders totalled by day. The range is in the URL (`?days=30`), and
 * switching it reloads only the screen's `data`.
 */
export default function SalesReport({ data }: ScreenProps<typeof salesReport>) {
  function show(days: number) {
    router.get(
      `${window.location.pathname}?days=${days}`,
      {},
      { only: ['data'], preserveState: true, preserveScroll: true, replace: true }
    )
  }

  return (
    <section className="azu-panel" aria-labelledby="sales-report-range">
      {/* The panel's header bar: the summary, then the range */}
      <div
        className="azu-panel-title"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <h2 id="sales-report-range" style={{ margin: 0, font: 'inherit' }}>
          Last {data.days} days: {data.orders} {data.orders === 1 ? 'order' : 'orders'},{' '}
          {naira(data.total)}
        </h2>
        <div role="group" aria-label="Range" style={{ display: 'flex', gap: 8 }}>
          {data.ranges.map((days) => (
            <button
              key={days}
              type="button"
              className={days === data.days ? 'azu-button azu-button-primary' : 'azu-button'}
              aria-pressed={days === data.days}
              onClick={() => show(days)}
            >
              {days} days
            </button>
          ))}
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="azu-table" data-sales-report>
          <caption className="azu-visually-hidden">Orders and totals by day</caption>
          <thead>
            <tr>
              <th className="azu-th" scope="col">
                Day
              </th>
              <th className="azu-th" scope="col" style={{ textAlign: 'right' }}>
                Orders
              </th>
              <th className="azu-th" scope="col" style={{ textAlign: 'right' }}>
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {[...data.rows].reverse().map((row) => (
              <tr key={row.day} className="azu-row">
                <td className="azu-td">{day.format(new Date(`${row.day}T00:00:00Z`))}</td>
                <td className="azu-td azu-is-numeric">{row.orders}</td>
                <td className="azu-td azu-is-numeric">{naira(row.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
