/**
 * Type tests for widgets (FR-24), run by `pnpm typecheck`. Every
 * `@ts-expect-error` must produce an error, so each mistake is proven
 * to fail tsc, and the valid widgets to compile.
 *
 * `link()` filter names aren't typed: resources don't carry their
 * filters' names in their type. Boot and `azu:doctor` check them.
 */
import { defineScreen, metric } from '@mezielabs/azu'
import { accessAdmin } from '#abilities/main'
import orders from '#admin/resources/order_resource'
import products from '#admin/resources/product_resource'

export const valid = defineScreen({
  label: 'Overview',
  ability: accessAdmin,
  ranges: ['today', '7d', '30d', 'month'],
  widgets: [
    // Decimal columns the resource lists as column.decimal(), and number columns
    metric.value('Revenue').sum(orders, 'total').date('placedAt').format('currency', 'NGN'),
    metric.value('Stock').sum(products, 'stock'),
    metric.value('Average price').avg(products, 'price'),
    metric.value('Cheapest').min(products, 'price'),
    metric.partition('By status').count(orders).groupBy('status').date('placedAt'),
    metric.progress('Goal').sum(orders, 'total').date('placedAt').period('quarter').goal(1),
    metric.table('Recent').resource(orders).latest('placedAt').columns(['number', 'total']),
    metric
      .value('Custom')
      .using(async (_ctx, range) => range.start.day)
      .ability(accessAdmin),
  ],
})

export const misspelled = [
  // @ts-expect-error a column the model doesn't have
  metric.value('Revenue').sum(orders, 'totl'),
  // @ts-expect-error a date column the model doesn't have
  metric.value('Orders').count(orders).date('placedOn'),
  // @ts-expect-error a group column the model doesn't have
  metric.partition('By status').count(orders).groupBy('state'),
  // @ts-expect-error a sort column the model doesn't have
  metric.table('Recent').resource(orders).latest('placed'),
  // @ts-expect-error a column the resource doesn't list
  metric.table('Recent').resource(orders).columns(['number', 'notes']),
]

export const wrongKind = [
  // @ts-expect-error sum() on a text column
  metric.value('Numbers').sum(orders, 'number'),
  // @ts-expect-error avg() on a text column, though decimals are typed string too
  metric.value('Names').avg(products, 'name'),
  // @ts-expect-error date() on a text column
  metric.value('Orders').count(orders).date('status'),
  // @ts-expect-error a goal is a number
  metric.progress('Goal').count(orders).date('placedAt').goal('lots'),
  // @ts-expect-error periods are day, week, month, quarter or year
  metric.progress('Goal').count(orders).date('placedAt').period('fortnight'),
  // @ts-expect-error widths are 1 to 4
  metric.value('Orders').count(orders).width(5),
]

export const noAbility = defineScreen({
  label: 'Overview',
  ability: accessAdmin,
  widgets: [
    // @ts-expect-error using() needs ability(): there's no resource to check
    metric.value('Custom').using(() => 1),
  ],
})

export const unknownRange = defineScreen({
  label: 'Overview',
  ability: accessAdmin,
  // @ts-expect-error ranges are today, 7d, 30d, 90d, month, quarter or year
  ranges: ['fortnight'],
  widgets: [metric.value('Orders').count(orders)],
})

// @ts-expect-error widgets and a component on one screen
export const withComponent = defineScreen({
  label: 'Overview',
  ability: accessAdmin,
  component: 'Overview',
  widgets: [metric.value('Orders').count(orders)],
})
