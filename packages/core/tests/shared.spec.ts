import { test } from '@japa/runner'
import { escapeLike } from '../src/list/list_records.ts'
import {
  effectiveTheme,
  storedTheme,
  themeBootScript,
  toggledTheme,
  activeFilters,
  dateRangeValue,
  isDate,
  parseDateRange,
  parseFilterValue,
  withFilter,
  actionUrl,
  bulkActionsFor,
  chunkedRunNote,
  filterValueLabel,
  listSummary,
  pageWindow,
  usedComponentNames,
  offersAllMatching,
  selectionSummary,
  dismissLabel,
  formatDateTime,
  formatDecimal,
  formatNumber,
  formatRelative,
  listStateToQuery,
  listStateUrl,
  nextListState,
  parseListState,
  truncate,
  withPageParam,
  type ListState,
} from '../shared.ts'
import type { ActionSchema, ListRow } from '../src/schema.ts'

const options = { defaultPerPage: 25 as const, sortable: ['name', 'price'] }
const base: ListState = {
  page: 1,
  perPage: 25,
  sort: null,
  direction: 'asc',
  search: '',
  filters: {},
}

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
      filters: {},
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
      filters: {},
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

test.group('Relation table pages', () => {
  test('sets one page parameter and keeps the others', ({ assert }) => {
    assert.equal(
      withPageParam('/admin/resources/categories/1', 'productsPage', 2),
      '/admin/resources/categories/1?productsPage=2'
    )
    assert.equal(
      withPageParam('/c/1?ordersPage=3&productsPage=2', 'productsPage', 4),
      '/c/1?ordersPage=3&productsPage=4'
    )
  })

  test('leaves page 1 out', ({ assert }) => {
    assert.equal(withPageParam('/c/1?productsPage=2', 'productsPage', 1), '/c/1')
  })
})

test.group('Actions (FR-12)', () => {
  const bulk = (name: string): ActionSchema => ({
    kind: 'bulk',
    name,
    label: name,
    confirm: null,
    ability: 'update',
    destructive: false,
    fields: [],
  })
  const row = (id: number, actions: ListRow['abilities']['actions']): ListRow => ({
    id,
    title: null,
    cells: {},
    abilities: { view: true, actions },
  })

  test('posts to the action route', ({ assert }) => {
    assert.equal(
      actionUrl('/admin', 'products', { kind: 'row', name: 'restock' }),
      '/admin/resources/products/actions/row/restock'
    )
  })

  test('offers a bulk action when any selected row allows it', ({ assert }) => {
    const rows = [row(1, ['bulk.publish']), row(2, []), row(3, ['bulk.delete'])]
    const actions = [bulk('publish'), bulk('delete')]
    assert.deepEqual(
      bulkActionsFor(actions, rows, [1, 2]).map((item) => item.name),
      ['publish']
    )
    assert.deepEqual(bulkActionsFor(actions, rows, [2]), [])
  })

  test('the dialog never shows two Cancel buttons', ({ assert }) => {
    assert.equal(dismissLabel({ label: 'Delete' }), 'Cancel')
    assert.equal(dismissLabel({ label: 'Cancel' }), 'Close')
    assert.equal(dismissLabel({ label: 'Cancel orders' }), 'Close')
    assert.equal(dismissLabel({ label: 'Cancellation report' }), 'Cancel')
  })
})

test.group('List filters (URL, FR-13)', () => {
  const filters = [
    {
      name: 'status',
      kind: 'select' as const,
      options: { draft: 'Draft', published: 'Published' },
    },
    { name: 'isFeatured', kind: 'boolean' as const, options: null },
    { name: 'createdAt', kind: 'dateRange' as const, options: null },
    { name: 'category', kind: 'belongsTo' as const, options: null },
    { name: 'low-stock', kind: 'custom' as const, options: null },
  ]
  const withFilters = { ...options, filters }

  test('reads each kind of filter from its own parameter', ({ assert }) => {
    const state = parseListState(
      new URLSearchParams(
        'status=published&isFeatured=false&createdAt=2026-10-01..2026-10-31&category=3&low-stock=1'
      ),
      withFilters
    )
    assert.deepEqual(state.filters, {
      'status': 'published',
      'isFeatured': 'false',
      'createdAt': '2026-10-01..2026-10-31',
      'category': '3',
      'low-stock': '1',
    })
  })

  test('drops values that do not fit their filter, and unknown parameters', ({ assert }) => {
    const state = parseListState(
      {
        'status': 'archived',
        'isFeatured': 'yes',
        'createdAt': '2026-02-30..',
        'category': "3' or 1=1",
        'low-stock': 'true',
        'secret': 'x',
      },
      withFilters
    )
    assert.deepEqual(state.filters, {})
    // Without the filter list (a hasMany table), no filter is read
    assert.deepEqual(parseListState({ status: 'draft' }, options).filters, {})
  })

  test('date ranges: either end optional, real dates only, ends in order', ({ assert }) => {
    assert.deepEqual(parseDateRange('2026-10-01..'), { from: '2026-10-01', to: null })
    assert.deepEqual(parseDateRange('..2026-10-31'), { from: null, to: '2026-10-31' })
    assert.deepEqual(parseDateRange('2026-10-31..2026-10-01'), {
      from: '2026-10-01',
      to: '2026-10-31',
    })
    assert.isNull(parseDateRange('..'))
    assert.isNull(parseDateRange('2026-10-01'))
    assert.isNull(parseDateRange('2026-13-01..'))
    assert.isTrue(isDate('2028-02-29'))
    assert.isFalse(isDate('2026-02-29'))
    assert.equal(dateRangeValue({ from: null, to: '2026-10-31' }), '..2026-10-31')
    assert.isNull(dateRangeValue({ from: null, to: null }))
    assert.equal(
      parseFilterValue({ kind: 'dateRange', options: null }, '2026-10-31..2026-10-01'),
      '2026-10-01..2026-10-31'
    )
  })

  test('filtered URLs round-trip with search and sort, so they can be bookmarked', ({ assert }) => {
    const state: ListState = {
      ...base,
      search: 'pot',
      sort: 'price',
      direction: 'desc',
      filters: { 'status': 'published', 'low-stock': '1' },
    }
    const url = listStateUrl('/admin/resources/products', state, options)
    assert.equal(
      url,
      '/admin/resources/products?search=pot&status=published&low-stock=1&sort=price&direction=desc'
    )
    assert.deepEqual(parseListState(new URL(url, 'http://x').searchParams, withFilters), state)
  })

  test('changing a filter goes back to page 1', ({ assert }) => {
    const onPage3 = { ...base, page: 3 }
    const next = nextListState(onPage3, { filters: withFilter({}, 'status', 'draft') })
    assert.equal(next.page, 1)
    assert.deepEqual(next.filters, { status: 'draft' })
  })

  test('withFilter sets and clears; activeFilters counts', ({ assert }) => {
    const values = withFilter({ status: 'draft' }, 'category', '3')
    assert.deepEqual(values, { status: 'draft', category: '3' })
    assert.deepEqual(withFilter(values, 'status', null), { category: '3' })
    assert.equal(activeFilters(values, filters), 2)
  })
})

test.group('Theme choice (FR-14)', () => {
  test('follows the OS until a choice is stored', ({ assert }) => {
    assert.equal(effectiveTheme(null, true), 'dark')
    assert.equal(effectiveTheme(null, false), 'light')
    assert.equal(effectiveTheme('light', true), 'light')
    assert.isNull(storedTheme('sepia'))
  })

  test('a toggle remembers the other theme, or forgets when that is the OS theme', ({ assert }) => {
    // OS light: toggling to dark remembers dark; toggling back follows the OS again
    assert.equal(toggledTheme('light', false), 'dark')
    assert.isNull(toggledTheme('dark', false))
    // OS dark
    assert.equal(toggledTheme('dark', true), 'light')
    assert.isNull(toggledTheme('light', true))
  })

  test('the boot script reads the stored choice and survives blocked storage', ({ assert }) => {
    const script = themeBootScript()
    assert.include(script, 'localStorage.getItem("azu-theme")')
    assert.include(script, 'setAttribute("data-azu-theme",t)')
    assert.match(script, /^try\{.*\}catch\(e\)\{\}$/)
  })
})

test.group('Bulk runs on all matching rows (FR-17)', () => {
  test('offers every matching row once the whole page is selected and more match', ({ assert }) => {
    assert.isTrue(offersAllMatching(25, 25, 1204))
    assert.isFalse(offersAllMatching(24, 25, 1204))
    // Everything matching is already on the page
    assert.isFalse(offersAllMatching(25, 25, 25))
    assert.isFalse(offersAllMatching(0, 0, 0))
  })

  test('summarises the selection', ({ assert }) => {
    assert.equal(selectionSummary(0, null), '')
    assert.equal(selectionSummary(3, null), '3 selected')
    assert.equal(selectionSummary(25, 1204), 'All 1,204 matching selected')
  })

  test('warns about batches only when a run takes more than one', ({ assert }) => {
    assert.isNull(chunkedRunNote(500))
    assert.match(chunkedRunNote(501)!, /^It runs in batches of 500, each saved on its own\./)
  })
})

test.group('App components a page renders (lazy registry)', () => {
  test('collects the components a page renders', ({ assert }) => {
    const resource = {
      columns: [
        { name: 'stock', component: 'StockBar' },
        { name: 'name', component: null },
      ],
      // Only forms render field components
      fields: [{ name: 'sku', component: 'SkuInput' }],
      actions: [{ fields: [{ name: 'note', component: 'NoteInput' }] }],
      slots: { header: null, beforeTable: 'LowStockNotice' },
    }

    assert.sameMembers(
      [...usedComponentNames('azu/resource/index', { resource, list: { rows: [] } })],
      ['StockBar', 'NoteInput', 'LowStockNotice']
    )
    assert.sameMembers(
      [
        ...usedComponentNames('azu/resource/create', {
          resource: { ...resource, slots: { ...resource.slots, afterForm: 'PricingHelp' } },
          form: { fields: [{ component: 'SkuInput' }] },
        }),
      ],
      // The form's fields and its own slots; no columns, no beforeTable
      ['SkuInput', 'PricingHelp']
    )
    assert.sameMembers(
      [
        ...usedComponentNames('azu/resource/show', {
          resource,
          relations: [{ columns: [{ component: 'OrderTotal' }] }],
        }),
      ],
      ['OrderTotal', 'NoteInput']
    )
    assert.equal(usedComponentNames('azu/dashboard', undefined).size, 0)
  })
})

test.group('List summary (layout 2/4)', () => {
  const filters = [
    { kind: 'select', name: 'status', label: 'Status', options: { published: 'Published' } },
    { kind: 'belongsTo', name: 'category', label: 'Category', options: null },
    { kind: 'dateRange', name: 'createdAt', label: 'Created at', options: null },
    { kind: 'custom', name: 'low-stock', label: 'Low stock', options: null },
    { kind: 'boolean', name: 'isFeatured', label: 'Featured', options: null },
  ].map((filter) => ({
    ...filter,
    value: null,
    selected: filter.name === 'category' ? { id: 3, title: 'Books' } : null,
    optionsUrl: null,
  })) as never[]

  test('filter values read as labels', ({ assert }) => {
    const [status, category, created, lowStock, featured] = filters as any[]
    assert.equal(filterValueLabel(status, 'published'), 'Published')
    assert.equal(filterValueLabel(category, '3'), 'Books')
    assert.equal(filterValueLabel(created, '2026-10-01..2026-10-31'), '1 Oct 2026 – 31 Oct 2026')
    assert.equal(filterValueLabel(created, '2026-10-01..'), 'from 1 Oct 2026')
    assert.equal(filterValueLabel(lowStock, '1'), '')
    assert.equal(filterValueLabel(featured, 'false'), 'No')
    assert.isNull(filterValueLabel(status, null))
  })

  test('says how many rows, of how many, and why', ({ assert }) => {
    const noun = { one: 'product', many: 'products' }
    assert.equal(
      listSummary({
        meta: { total: 40, unfilteredTotal: null },
        noun,
        filters,
        values: {},
        search: '',
      }),
      '40 products'
    )
    assert.equal(
      listSummary({
        meta: { total: 32, unfilteredTotal: 1040 },
        noun,
        filters,
        values: { 'status': 'published', 'low-stock': '1', 'category': '3' },
        search: 'clay',
      }),
      '32 of 1,040 products · filtered by Status: Published, Category: Books and Low stock · matching “clay”'
    )
  })

  test('page numbers: the ends, the current page and its neighbours', ({ assert }) => {
    assert.deepEqual(pageWindow(1, 1), [1])
    assert.deepEqual(pageWindow(1, 3), [1, 2, 3])
    assert.deepEqual(pageWindow(6, 20), [1, null, 5, 6, 7, null, 20])
    assert.deepEqual(pageWindow(3, 20), [1, 2, 3, 4, null, 20])
  })
})
