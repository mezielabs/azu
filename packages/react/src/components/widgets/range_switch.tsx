import { router, usePage } from '@inertiajs/react'
import { RANGE_LABELS, withRange, type RangeName } from '@mezielabs/azu/shared'

/**
 * A widgets screen's range switch (FR-24): one pressed button per range.
 * Switching keeps the range in `?range=` with a partial visit, then
 * reloads each widget's data in its own request, so one slow widget
 * doesn't hold up the others.
 */
export function RangeSwitch(props: {
  ranges: RangeName[]
  current: RangeName
  /** The widget props to reload, `widget0`… */
  widgets: string[]
}) {
  const { url } = usePage()
  if (props.ranges.length < 2) return null

  function select(range: RangeName) {
    if (range === props.current) return
    // Deferred loads and retries are async too. Abort the old period before
    // changing its label, so none of those responses can overwrite the new one.
    router.cancelAll({ sync: false, prefetch: false })
    router.get(
      withRange(url, range, props.ranges[0]),
      {},
      {
        only: ['range'],
        preserveState: true,
        preserveScroll: true,
        replace: true,
        onSuccess: () => {
          for (const key of props.widgets) router.reload({ only: [key] })
        },
      }
    )
  }

  return (
    <div className="azu-range-switch" role="group" aria-label="Date range">
      {props.ranges.map((range) => (
        <button
          key={range}
          type="button"
          className="azu-range-option"
          aria-pressed={range === props.current}
          onClick={() => select(range)}
        >
          {RANGE_LABELS[range]}
        </button>
      ))}
    </div>
  )
}
