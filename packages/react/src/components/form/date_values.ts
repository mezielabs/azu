/**
 * Date values between the wire and React Aria's date pickers.
 *
 * The server sends dates as `YYYY-MM-DD` and datetimes as ISO strings
 * with an offset. Forms send back what VineJS's `vine.date()` accepts by
 * default: `YYYY-MM-DD`, and `YYYY-MM-DD HH:mm:ss` as wall-clock time in
 * the app's timezone, which is the server's own, so the validator
 * parses it to the right instant.
 */
import {
  now,
  parseAbsolute,
  parseDate,
  toCalendarDateTime,
  type CalendarDate,
  type ZonedDateTime,
} from '@internationalized/date'

export function toCalendarDate(value: string | null): CalendarDate | null {
  if (!value) return null
  try {
    return parseDate(value.slice(0, 10))
  } catch {
    return null
  }
}

export function toZonedDateTime(value: string | null, timezone: string): ZonedDateTime | null {
  if (!value) return null
  try {
    return parseAbsolute(value, timezone)
  } catch {
    return null
  }
}

export function fromCalendarDate(value: CalendarDate | null): string | null {
  return value ? value.toString().slice(0, 10) : null
}

/**
 * Form state keeps the exact instant, so the picker reads it back
 * unchanged.
 */
export function fromZonedDateTime(value: ZonedDateTime | null): string | null {
  return value ? value.toAbsoluteString() : null
}

/**
 * What a datetime field submits: `2026-10-25 01:30:00`, wall-clock time
 * in the app's timezone.
 */
export function toWireDateTime(value: string | null, timezone: string): string | null {
  const zoned = toZonedDateTime(value, timezone)
  if (!zoned) return value
  return toCalendarDateTime(zoned).set({ millisecond: 0 }).toString().replace('T', ' ')
}

/**
 * Midnight today in the app's timezone. An empty datetime picker starts
 * from it, so the value it produces carries the zone.
 */
export function zonedPlaceholder(timezone: string): ZonedDateTime {
  return now(timezone).set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
}
