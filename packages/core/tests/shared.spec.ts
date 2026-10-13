import { test } from '@japa/runner'
import { escapeLike } from '../src/list/list_records.ts'
import {
  formatDateTime,
  formatDecimal,
  formatNumber,
  formatRelative,
  listStateToQuery,
  listStateUrl,
  nextListState,
  parseListState,
  truncate,
  type ListState,
} from '../shared.ts'

const options = { defaultPerPage: 25 as const, sortable: ['name', 'price'] }
const base: ListState = { page: 1, perPage: 25, sort: null, direction: 'asc', search: '' }

test.group('List state (URL)', () => {
  test('reads a full state from the query string', ({ assert }) => {
    const state = parseListState(
      new URLSearchParams('page=3&perPage=50&sort=price&direction=desc&search=%20pot%20'),
      options
    )
    assert.deepEqual(state, {
      page: 3,
      perPage: 50,
      sort: 'price',
      direction: 'desc',
      search: 'pot',
    })
  })

  test('falls back to defaults for invalid or unknown values', ({ assert }) => {
    assert.deepEqual(
      parseListState({ page: '-2', perPage: '30', sort: 'secret', direction: 'sideways' }, options),
      base
    )
    assert.deepEqual(parseListState({ page: 'abc' }, options), base)
    assert.equal(parseListState({ perPage: '10' }, options).perPage, 10)
  })

  test('only sorts by sortable columns, and drops the direction without a sort', ({ assert }) => {
    assert.isNull(parseListState({ sort: 'stock' }, options).sort)
    assert.equal(parseListState({ direction: 'desc' }, options).direction, 'asc')
  })

  test('caps the search length', ({ assert }) => {
    assert.lengthOf(parseListState({ search: 'x'.repeat(500) }, options).search, 200)
  })

  test('leaves defaults out of URLs, and round-trips', ({ assert }) => {
    assert.deepEqual(listStateToQuery(base, options), {})
    const state: ListState = {
      page: 2,
      perPage: 100,
      sort: 'name',
      direction: 'desc',
      search: 'a b',
    }
    const url = listStateUrl('/admin/resources/products', state, options)

    assert.equal(
      url,
      '/admin/resources/products?search=a+b&sort=name&direction=desc&perPage=100&page=2'
    )
    assert.deepEqual(parseListState(new URL(url, 'http://x').searchParams, options), state)
    assert.equal(
      listStateUrl('/admin/resources/products', base, options),
      '/admin/resources/products'
    )
  })

  test('changing search, sort or page size goes back to page 1', ({ assert }) => {
    const onPage3 = { ...base, page: 3 }
    assert.equal(nextListState(onPage3, { search: 'x' }).page, 1)
    assert.equal(nextListState(onPage3, { sort: 'name' }).page, 1)
    assert.equal(nextListState(onPage3, { perPage: 50 }).page, 1)
    assert.equal(nextListState(onPage3, { page: 4 }).page, 4)
  })
})

test.group('Formatting', () => {
  test('decimals format from their exact strings, never through Number', ({ assert }) => {
    assert.equal(
      formatDecimal('12345678901234567.89', { style: 'currency', currency: 'NGN' }, 'en-NG'),
      '₦12,345,678,901,234,567.89'
    )
    assert.equal(formatDecimal('0.30000000000000000001', null, 'en'), '0.30000000000000000001')
    assert.equal(formatDecimal('1750.50', null, 'en'), '1,750.50')
    assert.equal(formatDecimal('1750.5', null, 'en'), '1,750.5')
    assert.equal(formatDecimal(null, null), '')
    assert.equal(formatDecimal('n/a', null), 'n/a')
  })

  test('numbers format with an optional currency or percent', ({ assert }) => {
    assert.equal(formatNumber(1234.5, null, 'en'), '1,234.5')
    assert.equal(formatNumber(1500, { style: 'currency', currency: 'USD' }, 'en-US'), '$1,500.00')
    assert.equal(formatNumber(0.125, { style: 'percent', currency: null }, 'en'), '12.5%')
    assert.equal(formatNumber(null, null), '')
  })

  test('dates format in the app timezone', ({ assert }) => {
    const iso = '2026-10-25T00:30:00.000Z'
    assert.include(formatDateTime(iso, { timezone: 'Europe/London', locale: 'en-GB' }), '01:30')
    assert.include(formatDateTime(iso, { timezone: 'Africa/Lagos', locale: 'en-GB' }), '01:30')
    assert.include(formatDateTime(iso, { timezone: 'UTC', locale: 'en-GB' }), '00:30')
    assert.notInclude(
      formatDateTime(iso, { timezone: 'UTC', locale: 'en-GB', dateOnly: true }),
      ':'
    )
    assert.equal(formatDateTime(null, { timezone: 'UTC' }), '')
  })

  test('relative times for hover titles', ({ assert }) => {
    const now = new Date('2026-10-12T12:00:00Z')
    assert.equal(formatRelative('2026-10-09T12:00:00Z', now, 'en'), '3 days ago')
    assert.equal(formatRelative('2026-10-12T13:00:00Z', now, 'en'), 'in 1 hour')
  })

  test('truncates long text at 60 characters', ({ assert }) => {
    assert.equal(truncate('short'), 'short')
    const cut = truncate('x'.repeat(80))
    assert.lengthOf([...cut], 60)
    assert.isTrue(cut.endsWith('…'))
  })
})

test.group('Search escaping', () => {
  test('escapes LIKE wildcards and the escape character itself', ({ assert }) => {
    assert.equal(escapeLike('50%'), '50!%')
    assert.equal(escapeLike('AB_12'), 'AB!_12')
    assert.equal(escapeLike('wow!'), 'wow!!')
    assert.equal(escapeLike('plain text'), 'plain text')
  })
})
