/**
 * Datetime input on its way to the app's validator.
 *
 * The form submits the exact instant the picker resolved (ISO 8601 with
 * `Z` or an offset), so a repeated hour at a DST change is never
 * ambiguous. VineJS's `vine.date()` accepts `YYYY-MM-DD HH:mm:ss` by
 * default and parses it in the server process's timezone, so the
 * instant is handed to it as wall-clock time in that timezone. Plain
 * `Intl`, no date library.
 */

type WallClock = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter(timezone: string) {
  let format = formatters.get(timezone)
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    formatters.set(timezone, format)
  }
  return format
}

/**
 * The wall-clock time of an instant in a timezone.
 */
export function wallClockAt(instant: number, timezone: string): WallClock {
  const parts = Object.fromEntries(
    formatter(timezone)
      .formatToParts(new Date(instant))
      .map((part) => [part.type, Number(part.value)])
  )
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  }
}

function asUtc(clock: WallClock) {
  return Date.UTC(clock.year, clock.month - 1, clock.day, clock.hour, clock.minute, clock.second)
}

/**
 * The timezone's UTC offset at an instant, in milliseconds.
 */
function offsetAt(instant: number, timezone: string) {
  const whole = Math.floor(instant / 1000) * 1000
  return asUtc(wallClockAt(whole, timezone)) - whole
}

/**
 * The instant a wall-clock time names in a timezone. A repeated time
 * (when clocks go back) gives the first of the two; a skipped time
 * (when clocks go forward) moves forward by the gap, as Luxon does.
 */
export function instantOf(clock: WallClock, timezone: string): number {
  const naive = asUtc(clock)
  const day = 24 * 60 * 60 * 1000
  // Offsets either side of any transition near this time
  const before = offsetAt(naive - day, timezone)
  const after = offsetAt(naive + day, timezone)
  const matches = [naive - before, naive - after].filter(
    (candidate) => asUtc(wallClockAt(candidate, timezone)) === naive
  )
  return matches.length > 0 ? Math.min(...matches) : naive - before
}

function pad(value: number, length = 2) {
  return String(value).padStart(length, '0')
}

const ABSOLUTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/i
const WALL_CLOCK = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/

/**
 * A submitted datetime, as `vine.date()` parses it by default: wall-clock
 * time in the server process's timezone. Accepts an exact instant (what
 * the form sends), or wall-clock time in the admin's timezone. Anything
 * else passes through, for the validator to report.
 */
export function toValidatorDateTime(
  value: unknown,
  timezones: { admin: string; process: string }
): unknown {
  if (typeof value !== 'string') return value

  let instant: number
  const wallClock = WALL_CLOCK.exec(value.trim())
  if (ABSOLUTE.test(value.trim())) {
    instant = Date.parse(value.trim())
  } else if (wallClock) {
    const [, year, month, day, hour, minute, second] = wallClock.map(Number)
    instant = instantOf({ year, month, day, hour, minute, second: second || 0 }, timezones.admin)
  } else {
    return value
  }
  if (Number.isNaN(instant)) return value

  const clock = wallClockAt(instant, timezones.process)
  return (
    `${pad(clock.year, 4)}-${pad(clock.month)}-${pad(clock.day)} ` +
    `${pad(clock.hour)}:${pad(clock.minute)}:${pad(clock.second)}`
  )
}
