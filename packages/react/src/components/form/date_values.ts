/**
 * Date values between the wire and React Aria's date pickers.
 *
 * The server sends dates as `YYYY-MM-DD` and datetimes as ISO strings
 * with an offset. Forms send dates back as `YYYY-MM-DD`, and datetimes
 * as the exact instant (`toAbsoluteString()`), so the repeated hour at a
 * DST change stays unambiguous. The server converts it for the app's
 * validator.
 */
import {
  now,
  parseAbsolute,
  parseDate,
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
 * Midnight today in the app's timezone. An empty datetime picker starts
 * from it, so the value it produces carries the zone.
 */
export function zonedPlaceholder(timezone: string): ZonedDateTime {
  return now(timezone).set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
}
