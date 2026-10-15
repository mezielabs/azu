import { test } from '@japa/runner'
import { databaseDateTime, startOfDay } from '../src/list/filters.ts'

const SQLITE = 'yyyy-MM-dd HH:mm:ss'
const POSTGRES = "yyyy-MM-dd'T'HH:mm:ss.SSSZZ"

test.group('dateRange filter boundaries (FR-13)', () => {
  test('a day starts at midnight in the admin timezone', ({ assert }) => {
    // Lagos is UTC+1 all year
    assert.equal(
      new Date(startOfDay('2026-10-05', 'Africa/Lagos')).toISOString(),
      '2026-10-04T23:00:00.000Z'
    )
    // The end of a range is the next midnight, exclusive
    assert.equal(
      new Date(startOfDay('2026-10-31', 'Africa/Lagos', 1)).toISOString(),
      '2026-10-31T23:00:00.000Z'
    )
    // Across a month end
    assert.equal(
      new Date(startOfDay('2026-12-31', 'UTC', 1)).toISOString(),
      '2027-01-01T00:00:00.000Z'
    )
  })

  test('the day London leaves summer time is 25 hours long', ({ assert }) => {
    const start = startOfDay('2026-10-25', 'Europe/London')
    const end = startOfDay('2026-10-25', 'Europe/London', 1)
    assert.equal(new Date(start).toISOString(), '2026-10-24T23:00:00.000Z')
    assert.equal((end - start) / 3_600_000, 25)
  })

  test('formats the boundary as Lucid writes datetimes, per dialect', ({ assert }) => {
    const instant = Date.parse('2026-10-04T23:00:00.000Z')
    // SQLite and MySQL: wall-clock time in the server process's timezone
    assert.equal(databaseDateTime(instant, SQLITE, 'UTC'), '2026-10-04 23:00:00')
    assert.equal(databaseDateTime(instant, SQLITE, 'Africa/Lagos'), '2026-10-05 00:00:00')
    // Postgres: with the offset, so timestamptz compares the exact instant
    assert.equal(databaseDateTime(instant, POSTGRES, 'UTC'), '2026-10-04T23:00:00.000+00:00')
    assert.equal(
      databaseDateTime(instant, POSTGRES, 'America/New_York'),
      '2026-10-04T19:00:00.000-04:00'
    )
  })
})
