import { router, usePage } from '@inertiajs/react'
import { useRef } from 'react'
import { RANGE_LABELS, withRange, type RangeName } from '@mezielabs/azu/shared'

/**
 * A widgets screen's range switch (FR-24): one pressed button per range.
 * Switching keeps the range in `?range=` with a partial visit, then
 * reloads each widget's data in its own request, so one slow widget
 * doesn't hold up the others.
 *
 * Only the latest switch's figures land (C01): each switch aborts the
 * previous period's widget requests (deferred loads, retries, reloads),
 * and a switch superseded before its visit finished never reloads.
 */
/**
 * Which switch is the latest. A switch whose range visit finishes after
 * a newer one started never starts its reloads (C01).
 */
let latest = 0

export function RangeSwitch(props: {
  ranges: RangeName[]
  current: RangeName
  /** The widget props to reload, `widget0`… */
  widgets: string[]
}) {
  const { url } = usePage()
  // The range a switch in flight is going to: `current` still names the old one
  const pending = useRef<RangeName | null>(null)
  if (props.ranges.length < 2) return null

  function select(range: RangeName) {
    if (range === (pending.current ?? props.current)) return
    const generation = ++latest
    pending.current = range
    // Deferred loads, retries and the last switch's reloads are async too:
    // abort the old period's before changing the label
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
          // A newer switch started while this visit was finishing
          if (generation !== latest) return
          router.cancelAll({ sync: false, prefetch: false })
          for (const key of props.widgets) router.reload({ only: [key] })
        },
        onFinish: () => {
          if (generation === latest) pending.current = null
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
