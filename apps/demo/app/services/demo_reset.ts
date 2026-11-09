import type { DateTime } from 'luxon'
import Setting from '#models/setting'

/**
 * How long a request trusts the last reset time it read. The reset runs
 * in another process (`node ace demo:reset`), so this is how stale the
 * banner can be.
 */
const CACHE_MS = 30_000

let cached: { readAt: number; value: DateTime | null } | undefined

/**
 * When `node ace demo:reset` last finished, or `null` if it never has
 * (or the database is mid-reset). Cached for 30 seconds.
 */
export async function lastDemoReset(): Promise<DateTime | null> {
  if (cached && Date.now() - cached.readAt < CACHE_MS) return cached.value
  let value: DateTime | null = null
  try {
    const values = await Setting.values(['demoResetAt'])
    value = values.demoResetAt
  } catch {
    // During a reset the settings table can be missing for a moment
  }
  cached = { readAt: Date.now(), value }
  return value
}

/**
 * Records a finished reset, and drops this process's cached value.
 */
export async function recordDemoReset(at: DateTime) {
  await Setting.store({ demoResetAt: at })
  cached = undefined
}
