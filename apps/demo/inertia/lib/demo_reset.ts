/**
 * The public demo's banner text (DEMO_MODE), for the login page and the
 * admin panel: "This demo resets every hour. Last reset 12 minutes ago."
 */
export function demoResetMessage(
  everyMinutes: number,
  lastResetAt: string | null,
  now: number = Date.now()
): string {
  const every = everyMinutes === 60 ? 'every hour' : `every ${everyMinutes} minutes`
  const text = `This demo resets ${every}.`
  const at = lastResetAt ? Date.parse(lastResetAt) : Number.NaN
  if (Number.isNaN(at)) return text

  const minutes = Math.max(0, Math.floor((now - at) / 60_000))
  if (minutes === 0) return `${text} Last reset less than a minute ago.`
  return `${text} Last reset ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago.`
}

/**
 * Reads the `azu_demo` cookie the server sets with DEMO_MODE on
 * (app/middleware/demo_mode_middleware.ts): "<minutes>|<ISO time or empty>".
 * `null` when the demo mode is off.
 */
export function readDemoCookie(
  cookie: string
): { everyMinutes: number; lastResetAt: string | null } | null {
  const match = cookie.match(/(?:^|;\s*)azu_demo=([^;]*)/)
  if (!match) return null
  const [minutes, at] = decodeURIComponent(match[1]).split('|')
  const everyMinutes = Number(minutes)
  if (!Number.isFinite(everyMinutes) || everyMinutes <= 0) return null
  return { everyMinutes, lastResetAt: at || null }
}
