/**
 * Widgets on screens (FR-24): ranges, comparisons and progress, as
 * plain TypeScript the server and the front ends share
 * (non-negotiable 11). The server computes the boundaries in the
 * admin's timezone; this file names, parses and describes them.
 */

/**
 * The ranges a widgets screen can offer:
 *
 * - `today`: since midnight
 * - `7d`, `30d`, `90d`: the last 7, 30 or 90 days, today included
 * - `month`, `quarter`, `year`: month, quarter or year to date
 */
export const RANGE_NAMES = ['today', '7d', '30d', '90d', 'month', 'quarter', 'year'] as const

export type RangeName = (typeof RANGE_NAMES)[number]

/** Each range's label in the range switch */
export const RANGE_LABELS: Record<RangeName, string> = {
  'today': 'Today',
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
  'month': 'This month',
  'quarter': 'This quarter',
  'year': 'This year',
}

/** The query parameter holding a widgets screen's range */
export const RANGE_PARAM = 'range'

/** The ranges a screen offers when it names none */
export const DEFAULT_RANGES: readonly RangeName[] = ['30d']

export function isRangeName(value: unknown): value is RangeName {
  return typeof value === 'string' && (RANGE_NAMES as readonly string[]).includes(value)
}

/**
 * The range from the URL: one the screen offers, else its first (the
 * default), so a stale or hand-edited URL still shows the screen.
 */
export function parseRange(value: unknown, offered: readonly RangeName[]): RangeName {
  const first = offered[0] ?? DEFAULT_RANGES[0]
  return isRangeName(value) && offered.includes(value) ? value : first
}

/**
 * The periods a progress widget measures (FR-24), each to date: today,
 * this week (from Monday), this month, quarter or year.
 */
export const PERIODS = ['day', 'week', 'month', 'quarter', 'year'] as const

export type Period = (typeof PERIODS)[number]

/**
 * The buckets a trend widget (FR-25) can count in: hours, days, weeks
 * (from Monday) or months, in the admin's timezone.
 */
export const BUCKET_UNITS = ['hour', 'day', 'week', 'month'] as const

export type BucketUnit = (typeof BUCKET_UNITS)[number]

/**
 * A screen's current range, as the page gets it: its name, and the
 * days it and its comparison period cover, as `YYYY-MM-DD` dates in
 * `timezone`.
 */
export type RangeInfo = {
  name: RangeName
  from: string
  to: string
  previousFrom: string
  previousTo: string
  timezone: string
}

/** What a range is compared with, for the line under the title */
const COMPARED_WITH: Record<RangeName, string> = {
  'today': 'yesterday',
  '7d': 'the 7 days before',
  '30d': 'the 30 days before',
  '90d': 'the 90 days before',
  'month': 'the same days last month',
  'quarter': 'the same days last quarter',
  'year': 'the same days last year',
}

function formatDay(date: string, locale: string | undefined, withYear: boolean) {
  const [year, month, day] = date.split('-').map(Number)
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

/**
 * The line under a widgets screen's title: "Sep 21 – Oct 20, compared
 * with the 30 days before · Africa/Lagos". `compared` is false when no
 * widget compares.
 */
export function rangeSummary(
  range: RangeInfo,
  options: { compared?: boolean; locale?: string } = {}
): string {
  const withYear = range.from.slice(0, 4) !== range.to.slice(0, 4)
  const from = formatDay(range.from, options.locale, withYear)
  const days =
    range.from === range.to ? from : `${from} – ${formatDay(range.to, options.locale, withYear)}`
  const compared = options.compared === false ? '' : `, compared with ${COMPARED_WITH[range.name]}`
  return `${days}${compared} · ${range.timezone}`
}

/** A decimal string or a number, as a finite number (0 if not one) */
function toNumber(value: string | number | null): number {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : 0
}

/**
 * Which way is good for a value widget (FR-24): `higher` (revenue,
 * orders) or `lower` (cancellations, refunds, response times).
 */
export type Better = 'higher' | 'lower'

/**
 * A value against the previous period's:
 *
 * - `change`: up or down, by a percentage with one decimal ("12.4%"),
 *   and whether that's `better` or `worse`, given which way is good
 * - `new`: the previous value was 0 and this one isn't
 * - `same`: both are 0, or they're equal
 *
 * `direction` is always the real one (a decrease is down, whichever way
 * is good); front ends colour by `outcome`, and never by colour alone.
 * `new` and `same` are neutral.
 */
export type Comparison =
  | { kind: 'change'; direction: 'up' | 'down'; percent: string; outcome: 'better' | 'worse' }
  | { kind: 'new' }
  | { kind: 'same' }

export function compareValues(
  current: string | number,
  previous: string | number,
  better: Better = 'higher'
): Comparison {
  const now = toNumber(current)
  const before = toNumber(previous)
  if (now === before) return { kind: 'same' }
  if (before === 0) return { kind: 'new' }
  const change = ((now - before) / Math.abs(before)) * 100
  // One decimal, and never "0.0%" for a real change
  const percent = Math.abs(change) < 0.05 ? '<0.1%' : `${Math.abs(change).toFixed(1)}%`
  const direction = change > 0 ? 'up' : 'down'
  const improved = better === 'higher' ? direction === 'up' : direction === 'down'
  return { kind: 'change', direction, percent, outcome: improved ? 'better' : 'worse' }
}

/**
 * The comparison as words, for a screen reader or a tooltip: "Up 12.4%
 * from ₦4,281,750, better", "New", "No change".
 */
export function comparisonText(comparison: Comparison, previous: string): string {
  if (comparison.kind === 'new') return 'New'
  if (comparison.kind === 'same') return 'No change'
  const direction = comparison.direction === 'up' ? 'Up' : 'Down'
  return `${direction} ${comparison.percent} from ${previous}, ${comparison.outcome}`
}

/**
 * A share as a whole percentage for display, "54%". Above 100 when a
 * goal is passed.
 */
export function percentOf(share: number): string {
  if (!Number.isFinite(share) || share <= 0) return '0%'
  return `${Math.round(share * 100)}%`
}

/**
 * How much of a progress period is left: "12 days left", "3 hours left"
 * on the last day, "Ends today".
 */
export function timeLeft(milliseconds: number): string {
  const hours = Math.floor(milliseconds / 3_600_000)
  if (hours >= 24) {
    const days = Math.ceil(milliseconds / 86_400_000)
    return `${days} ${days === 1 ? 'day' : 'days'} left`
  }
  if (hours >= 1) return `${hours} ${hours === 1 ? 'hour' : 'hours'} left`
  return 'Ends soon'
}

/**
 * The URL with the range in `?range=`, keeping the rest of the query.
 * The default range is left out, as list state's defaults are.
 */
export function withRange(url: string, range: RangeName, defaultRange: RangeName): string {
  const [path, query = ''] = url.split('?')
  const params = new URLSearchParams(query)
  if (range === defaultRange) params.delete(RANGE_PARAM)
  else params.set(RANGE_PARAM, range)
  const next = params.toString()
  return next ? `${path}?${next}` : path
}
