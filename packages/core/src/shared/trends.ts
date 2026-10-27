/**
 * Trend widgets (FR-25): the chart's numbers and words, as plain
 * TypeScript the front ends share (non-negotiable 11). Dates are
 * formatted with `Intl` in the admin's timezone; no Luxon in the
 * browser.
 */
import { compactNumberFormat, type NumberFormat } from './format.ts'
import type { BucketUnit } from './metrics.ts'

/** A bucket as the chart gets it: its start and end, ISO instants */
export type ChartBucket = { start: string; end: string }

function parts(iso: string, timezone: string, options: Intl.DateTimeFormatOptions) {
  // US English parts ("Sep", not "Sept"), put together as "Wed 14 Oct"
  const values = new Intl.DateTimeFormat('en-US', { timeZone: timezone, ...options }).formatToParts(
    new Date(iso)
  )
  return Object.fromEntries(values.map((part) => [part.type, part.value])) as Record<string, string>
}

function clock(iso: string, timezone: string) {
  const { hour, minute } = parts(iso, timezone, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  return `${hour}:${minute}`
}

/**
 * Each bucket's full name, for the tooltip and the table: "14:00–15:00",
 * "Wed 14 Oct", "Week of 12 Oct", "October 2026". On the day the clocks
 * go back, the hour that happens twice gets its zone ("01:00–02:00 BST",
 * "01:00–02:00 GMT").
 */
export function bucketLabels(buckets: ChartBucket[], unit: BucketUnit, timezone: string): string[] {
  const labels = buckets.map((bucket) => {
    if (unit === 'hour') {
      const start = clock(bucket.start, timezone)
      const next = String((Number(start.slice(0, 2)) + 1) % 24).padStart(2, '0')
      return `${start}–${next}:${start.slice(3)}`
    }
    if (unit === 'day') {
      const { weekday, day, month } = parts(bucket.start, timezone, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
      return `${weekday} ${day} ${month}`
    }
    if (unit === 'week') {
      const { day, month } = parts(bucket.start, timezone, { day: 'numeric', month: 'short' })
      return `Week of ${day} ${month}`
    }
    const { month, year } = parts(bucket.start, timezone, { month: 'long', year: 'numeric' })
    return `${month} ${year}`
  })
  // A wall-clock hour that happens twice: tell them apart by zone
  return labels.map((label, index) => {
    if (labels.indexOf(label) === labels.lastIndexOf(label)) return label
    const { timeZoneName } = parts(buckets[index].start, timezone, {
      hour: 'numeric',
      timeZoneName: 'short',
    })
    return `${label} ${timeZoneName}`
  })
}

/** A bucket's short name under the x axis: "14:00", "14 Oct", "Oct" */
export function axisLabel(bucket: ChartBucket, unit: BucketUnit, timezone: string): string {
  if (unit === 'hour') return clock(bucket.start, timezone)
  if (unit === 'month') return parts(bucket.start, timezone, { month: 'short' }).month
  const { day, month } = parts(bucket.start, timezone, { day: 'numeric', month: 'short' })
  return `${day} ${month}`
}

/**
 * Which buckets get an x-axis label: 4 to 7 of them, spread from the
 * first to the last, and fewer when the chart is too narrow for them
 * not to overlap. `labelWidth` is the widest label's width.
 */
export function axisTicks(count: number, plotWidth: number, labelWidth: number): number[] {
  if (count <= 1) return count === 1 ? [0] : []
  const room = Math.floor(plotWidth / (labelWidth + 12))
  const wanted = Math.min(count, 7, Math.max(2, room))
  // An even step from the first; the last bucket takes the place of a
  // label that would sit too close to it
  const step = Math.max(1, Math.ceil((count - 1) / Math.max(1, wanted - 1)))
  const indices: number[] = []
  for (let index = 0; index < count; index += step) indices.push(index)
  const last = count - 1
  if (indices.at(-1) !== last) {
    const gap = (last - indices.at(-1)!) * (plotWidth / count)
    if (gap < labelWidth + 12 && indices.length > 1) indices.pop()
    indices.push(last)
  }
  return indices
}

/**
 * Y-axis ticks from 0: 3 or 4 round steps (1, 2, 2.5 or 5 times a
 * power of ten) covering `max`. All zero gives just the baseline.
 */
export function niceTicks(max: number): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0]
  const rough = max / 3
  const power = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * power).find((size) => size >= rough)!
  const ticks = [0]
  while (ticks.at(-1)! < max) ticks.push(Number((ticks.at(-1)! + step).toPrecision(12)))
  return ticks
}

/**
 * A y-axis label: the widget's format, as the cards and the tooltip
 * write it, in compact notation ("NGN 30K", "$30K", "1.2K", "40%")
 */
export function compactValue(value: number, format: NumberFormat, locale?: string): string {
  return compactNumberFormat(format, format?.style === 'percent' ? 0 : 1, locale).format(value)
}

/** Where things go: the plot's box inside the chart, in pixels */
export type ChartBox = { left: number; top: number; width: number; height: number }

/**
 * The chart's shapes for `values` (and `previous`) in `box`, with `top`
 * as the y axis's highest tick:
 *
 * - `x[i]`: the middle of bucket i
 * - `line` and `area`: SVG paths through the values (a single bucket
 *   is a point, drawn by the front end)
 * - `bars`: each bucket's bar, with a 2px gap, rounded on top only
 * - `previous`: the previous period's line, when given
 */
export function trendShapes(
  values: number[],
  previous: number[] | null,
  box: ChartBox,
  top: number
) {
  const count = values.length
  const step = count > 0 ? box.width / count : box.width
  const x = values.map((_, index) => box.left + step * (index + 0.5))
  const base = box.top + box.height
  const y = (value: number) => (top > 0 ? base - (Math.max(0, value) / top) * box.height : base)
  const path = (series: number[]) =>
    series
      .map((value, index) => `${index ? 'L' : 'M'}${x[index].toFixed(1)} ${y(value).toFixed(1)}`)
      .join(' ')

  const line = path(values)
  const area =
    count > 1 ? `${line} L${x[count - 1].toFixed(1)} ${base} L${x[0].toFixed(1)} ${base} Z` : ''
  const bars = values.map((value, index) => {
    const width = Math.max(1, step - 2)
    const left = box.left + step * index + 1
    const height = base - y(value)
    const radius = Math.min(3, width / 2, height)
    const yTop = base - height
    return height <= 0
      ? ''
      : `M${left} ${base} L${left} ${yTop + radius} Q${left} ${yTop} ${left + radius} ${yTop} ` +
          `L${left + width - radius} ${yTop} Q${left + width} ${yTop} ${left + width} ${yTop + radius} ` +
          `L${left + width} ${base} Z`
  })
  return {
    x,
    y: values.map(y),
    step,
    base,
    line,
    area,
    bars,
    previous: previous ? path(previous.slice(0, count)) : null,
    previousY: previous ? previous.slice(0, count).map(y) : null,
  }
}

/**
 * The bucket under a pointer at `pointerX` (relative to the chart), or
 * `null` outside the plot
 */
export function bucketAt(pointerX: number, box: ChartBox, count: number): number | null {
  if (count === 0 || pointerX < box.left || pointerX > box.left + box.width) return null
  return Math.min(count - 1, Math.max(0, Math.floor(((pointerX - box.left) / box.width) * count)))
}

/**
 * The previous period's line in a trend's tooltip and live region:
 * "Previous (Wed 16 Sep): NGN 20,500.00", or without its bucket's name
 * when there's none.
 */
export function previousLine(label: string | null, value: string): string {
  return label ? `Previous (${label}): ${value}` : `Previous: ${value}`
}
