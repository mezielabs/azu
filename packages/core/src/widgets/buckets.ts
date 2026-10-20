import type { DateTime } from 'luxon'
import type { BucketUnit, RangeName } from '../shared/metrics.ts'
import type { Bounds } from './ranges.ts'

/** The most buckets a trend draws (FR-25) */
export const MAX_BUCKETS = 100

/**
 * A trend's bucket when it names none (FR-25): hours for today, days
 * up to 90 days and month to date, weeks for a quarter, months for a
 * year.
 */
export function bucketFor(range: RangeName): BucketUnit {
  switch (range) {
    case 'today':
      return 'hour'
    case 'quarter':
      return 'week'
    case 'year':
      return 'month'
    default:
      return 'day'
  }
}

/** Days a range covers at least and at most */
const RANGE_DAYS: Record<RangeName, { min: number; max: number }> = {
  'today': { min: 1, max: 1 },
  '7d': { min: 7, max: 7 },
  '30d': { min: 30, max: 30 },
  '90d': { min: 90, max: 90 },
  'month': { min: 1, max: 31 },
  'quarter': { min: 1, max: 92 },
  'year': { min: 1, max: 366 },
}

/**
 * The fewest and most buckets of `unit` a range can need: days and
 * hours as they fall (a day can be 25 hours), weeks and months counting
 * the partial ones at either end
 */
export function bucketCounts(unit: BucketUnit, range: RangeName): { min: number; max: number } {
  const { min, max } = RANGE_DAYS[range]
  switch (unit) {
    case 'hour':
      // Rolling ranges start at midnight N-1 days ago: at least that many
      // whole days, plus the current hour
      return { min: (min - 1) * 24 + 1, max: max * 24 + 1 }
    case 'day':
      return { min, max }
    case 'week':
      return { min: Math.ceil(min / 7), max: Math.ceil(max / 7) + 1 }
    case 'month':
      return { min: Math.ceil(min / 31), max: Math.ceil(max / 28) + 1 }
  }
}

/**
 * A trend that would need more than `MAX_BUCKETS` in this range. Its
 * card says so, rather than a bare "Couldn't load this".
 */
export class TooManyBuckets extends Error {
  constructor(readonly unit: BucketUnit) {
    super(`More than ${MAX_BUCKETS} ${unit}s in this range: choose a shorter range`)
  }
}

/** One bucket, from `start` (inclusive) to `end` (exclusive) */
export type Bucket = { start: DateTime; end: DateTime }

/**
 * A stretch of time cut into buckets of `unit` (FR-25), in `timezone`,
 * with Luxon:
 *
 * - The first starts at the start of the unit that holds `bounds.start`
 *   (weeks on Monday); buckets follow until one reaches `bounds.end`.
 * - Days, weeks and months are calendar steps, so a day across a clock
 *   change is 23 or 25 hours.
 * - Hours are steps of 60 real minutes, so the skipped hour has no
 *   bucket and the repeated one has two.
 *
 * Throws once there would be more than `MAX_BUCKETS`.
 */
export function bucketBounds(unit: BucketUnit, bounds: Bounds, timezone: string): Bucket[] {
  const end = bounds.end.setZone(timezone)
  let start = bounds.start.setZone(timezone).startOf(unit)
  const buckets: Bucket[] = []
  while (start < end || buckets.length === 0) {
    const next = unit === 'hour' ? start.plus({ hours: 1 }) : start.plus({ [`${unit}s`]: 1 })
    buckets.push({ start, end: next })
    if (buckets.length > MAX_BUCKETS) throw new TooManyBuckets(unit)
    start = next
  }
  return buckets
}
