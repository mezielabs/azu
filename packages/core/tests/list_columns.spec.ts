import { test } from '@japa/runner'
import { column } from '../src/resources/columns.ts'
import { visibleListColumns } from '../src/shared/list_columns.ts'

const columns = [
  column.text('name'),
  column.text('sku').hiddenByDefault(),
  column.number('stock'),
].map((item) => item.toJSON())

test.group('Column visibility', () => {
  test('uses defaults, reveals hidden columns and keeps declaration order', ({ assert }) => {
    assert.deepEqual(
      visibleListColumns(columns, null).map((item) => item.name),
      ['name', 'stock']
    )
    const chosen = visibleListColumns(columns, ['stock', 'sku'])
    assert.deepEqual(
      chosen.map((item) => item.name),
      ['sku', 'stock']
    )
    assert.isTrue(chosen.every((item) => !item.hiddenByDefault))
    assert.isTrue(columns[1].hiddenByDefault)
  })
  test('stale or forged choices cannot introduce server-omitted columns', ({ assert }) => {
    assert.deepEqual(
      visibleListColumns(columns, ['private', 'sku']).map((item) => item.name),
      ['sku']
    )
    assert.deepEqual(
      visibleListColumns(columns, ['private']).map((item) => item.name),
      ['name', 'stock']
    )
    assert.deepEqual(
      visibleListColumns(columns, []).map((item) => item.name),
      ['name', 'stock']
    )
    assert.deepEqual(visibleListColumns([], ['private']), [])
    assert.deepEqual(
      visibleListColumns([columns[1]], null).map((item) => item.name),
      ['sku']
    )
  })
})
