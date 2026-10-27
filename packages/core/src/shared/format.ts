/**
 * Cell formatting for the list screen. Plain TypeScript with no UI
 * imports (non-negotiable 11). Decimals are formatted from their exact
 * strings: `Intl.NumberFormat` formats numeric strings exactly, and they
 * are never converted through `Number`.
 */

export type NumberFormat = { style: 'currency' | 'percent'; currency: string | null } | null

/**
 * The longest text shown in a list cell before it's cut with an
 * ellipsis (spec §5).
 */
export const TEXT_CELL_LENGTH = 60

const DECIMAL = /^-?\d+(\.\d+)?$/

/**
 * The `Intl.NumberFormat` options for a column's or widget's format, so
 * every place that shows a figure (cells, cards, tooltips, chart axes)
 * writes its currency the same way: "NGN 30,000.00", "NGN 30K".
 * `null` for a plain number.
 */
export function formatOptions(format: NumberFormat): Intl.NumberFormatOptions | null {
  if (format?.style === 'currency' && format.currency) {
    return { style: 'currency', currency: format.currency }
  }
  if (format?.style === 'percent') return { style: 'percent', maximumFractionDigits: 2 }
  return null
}

function numberFormat(format: NumberFormat, locale: string | undefined, fractionDigits?: number) {
  const options = formatOptions(format)
  if (options) return new Intl.NumberFormat(locale, options)
  // A decimal keeps its scale ('1750.50' stays two places); numbers show what they have
  return fractionDigits === undefined
    ? new Intl.NumberFormat(locale, { maximumFractionDigits: 20 })
    : new Intl.NumberFormat(locale, {
        minimumFractionDigits: Math.min(fractionDigits, 100),
        maximumFractionDigits: Math.min(fractionDigits, 100),
      })
}

/**
 * Formats a `number` attribute.
 */
export function formatNumber(value: number | null, format: NumberFormat, locale?: string): string {
  if (value === null || !Number.isFinite(value)) return ''
  return numberFormat(format, locale).format(value)
}

/**
 * Formats a decimal column's exact string. A plain decimal keeps all of
 * its digits; currency uses the currency's own precision.
 */
export function formatDecimal(value: string | null, format: NumberFormat, locale?: string): string {
  if (value === null) return ''
  const exact = value.trim()
  if (!DECIMAL.test(exact)) return exact
  const digits = exact.split('.')[1]?.length ?? 0
  // Intl.NumberFormat's format() accepts numeric strings and keeps them exact
  return numberFormat(format, locale, digits).format(exact as unknown as number)
}

/**
 * Formats an ISO timestamp in the app's timezone.
 */
export function formatDateTime(
  iso: string | null,
  options: { timezone: string; locale?: string; dateOnly?: boolean }
): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat(options.locale, {
    dateStyle: 'medium',
    ...(options.dateOnly ? {} : { timeStyle: 'short' }),
    timeZone: options.timezone,
  }).format(date)
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
  ['second', 1],
]

/**
 * "3 days ago", for the title shown on hover (spec §5).
 */
export function formatRelative(iso: string | null, now: Date, locale?: string): string {
  if (!iso) return ''
  const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000)
  if (Number.isNaN(seconds)) return ''
  const [unit, size] = RELATIVE_UNITS.find(([, length]) => Math.abs(seconds) >= length) ?? [
    'second',
    1,
  ]
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
    Math.round(seconds / size),
    unit
  )
}

/**
 * Cuts long text for a list cell, keeping whole characters.
 */
export function truncate(text: string, length = TEXT_CELL_LENGTH): string {
  const characters = [...text]
  return characters.length > length ? `${characters.slice(0, length - 1).join('')}…` : text
}
