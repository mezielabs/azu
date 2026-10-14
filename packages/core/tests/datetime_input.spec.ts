import { test } from '@japa/runner'
import { instantOf, toValidatorDateTime } from '../src/forms/datetime_input.ts'

const iso = (instant: number) => new Date(instant).toISOString()

test.group('Datetime input', () => {
  test('an exact instant becomes wall-clock time in the process timezone', ({ assert }) => {
    const lagos = { admin: 'Africa/Lagos', process: 'UTC' }
    assert.equal(toValidatorDateTime('2026-11-05T13:30:00.000Z', lagos), '2026-11-05 13:30:00')
    assert.equal(toValidatorDateTime('2026-11-05T14:30:00+01:00', lagos), '2026-11-05 13:30:00')
    assert.equal(
      toValidatorDateTime('2026-11-05T13:30:00Z', { admin: 'UTC', process: 'Africa/Lagos' }),
      '2026-11-05 14:30:00'
    )
  })

  test('wall-clock time is read in the admin timezone', ({ assert }) => {
    assert.equal(
      toValidatorDateTime('2026-11-05 14:30:00', { admin: 'Africa/Lagos', process: 'UTC' }),
      '2026-11-05 13:30:00'
    )
    assert.equal(
      toValidatorDateTime('2026-11-05T14:30', { admin: 'Asia/Kolkata', process: 'UTC' }),
      '2026-11-05 09:00:00'
    )
  })

  test('the repeated hour when clocks go back gives the first occurrence', ({ assert }) => {
    const clock = { year: 2026, month: 10, day: 25, hour: 1, minute: 30, second: 0 }
    assert.equal(iso(instantOf(clock, 'Europe/London')), '2026-10-25T00:30:00.000Z')
  })

  test('a skipped time when clocks go forward moves forward by the gap', ({ assert }) => {
    // London skips 01:00 to 02:00 on 2026-03-29
    const clock = { year: 2026, month: 3, day: 29, hour: 1, minute: 30, second: 0 }
    assert.equal(iso(instantOf(clock, 'Europe/London')), '2026-03-29T01:30:00.000Z')
  })

  test('times either side of a change are exact', ({ assert }) => {
    const at = (day: number, hour: number) =>
      iso(instantOf({ year: 2026, month: 10, day, hour, minute: 30, second: 0 }, 'Europe/London'))
    assert.equal(at(24, 9), '2026-10-24T08:30:00.000Z')
    assert.equal(at(25, 2), '2026-10-25T02:30:00.000Z')
  })

  test('anything else passes through for the validator to report', ({ assert }) => {
    const zones = { admin: 'UTC', process: 'UTC' }
    assert.isNull(toValidatorDateTime(null, zones))
    assert.equal(toValidatorDateTime('next tuesday', zones), 'next tuesday')
    assert.equal(toValidatorDateTime(42, zones), 42)
  })
})
