import { DateTime } from 'luxon'
import type { Period, RangeInfo, RangeName } from '../shared/metrics.ts'

/**
 * A stretch of time: from `start` (inclusive) to `end` (exclusive), in
 * the admin's timezone.
 */
export type Bounds = { start: DateTime; end: DateTime }

/** A range, and the period its value widgets compare with */
export type RangeBounds = Bounds & { previous: Bounds }

const ROLLING: Partial<Record<RangeName, number>> = { '7d': 7, '30d': 30, '90d': 90 }

const TO_DATE: Partial<Record<RangeName, 'day' | 'month' | 'quarter' | 'year'>> = {
  today: 'day',
  month: 'month',
  quarter: 'quarter',
  year: 'year',
}

/**
 * A range's boundaries at `now`, in `timezone` (FR-24):
 *
 * - `7d`, `30d`, `90d`: from midnight N-1 days ago until now. The
 *   previous period is the same stretch, N days earlier.
 * - `today`, `month`, `quarter`, `year`: from the start of the day,
 *   month, quarter or year until now. The previous period starts at the
 *   start of the one before and runs for as long as this one has so
 *   far: month to date on the 20th at 10:00 compares with the 1st to
 *   the 20th at 10:00 of last month. It never runs into this period, so
 *   March 1st to 31st compares with February only.
 */
export function rangeBounds(
  name: RangeName,
  timezone: string,
  now: DateTime = DateTime.now()
): RangeBounds {
  const current = now.setZone(timezone)
  const days = ROLLING[name]
  if (days) {
    const start = current.startOf('day').minus({ days: days - 1 })
    return {
      start,
      end: current,
      previous: { start: start.minus({ days }), end: current.minus({ days }) },
    }
  }
  const unit = TO_DATE[name] ?? 'day'
  const start = current.startOf(unit)
  const previousStart = start.minus({ [`${unit}s`]: 1 })
  const elapsed = current.toMillis() - start.toMillis()
  const previousEnd = DateTime.fromMillis(
    Math.min(previousStart.toMillis() + elapsed, start.toMillis()),
    { zone: timezone }
  )
  return { start, end: current, previous: { start: previousStart, end: previousEnd } }
}

/**
 * A progress widget's period (FR-24), in `timezone`: from its start to
 * its end, and how far through it `now` is (0 to 1). Weeks start on
 * Monday, as Luxon's do.
 */
export function periodBounds(
  period: Period,
  timezone: string,
  now: DateTime = DateTime.now()
): Bounds & { now: DateTime; elapsed: number } {
  const current = now.setZone(timezone)
  const start = current.startOf(period)
  const end = start.plus({ [`${period}s`]: 1 })
  const elapsed = (current.toMillis() - start.toMillis()) / (end.toMillis() - start.toMillis())
  return { start, end, now: current, elapsed: Math.min(Math.max(elapsed, 0), 1) }
}

/**
 * What the page gets about its range: the days it and its comparison
 * period cover. A period that ends exactly at midnight ends the day
 * before.
 */
export function rangeInfo(name: RangeName, bounds: RangeBounds, timezone: string): RangeInfo {
  const lastDay = (end: DateTime, start: DateTime) =>
    (end > start && end.equals(end.startOf('day')) ? end.minus({ days: 1 }) : end).toISODate()!
  return {
    name,
    from: bounds.start.toISODate()!,
    to: lastDay(bounds.end, bounds.start),
    previousFrom: bounds.previous.start.toISODate()!,
    previousTo: lastDay(bounds.previous.end, bounds.previous.start),
    timezone,
  }
}
