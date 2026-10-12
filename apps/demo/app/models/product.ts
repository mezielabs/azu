import { ProductSchema } from '#database/schema'
import { belongsTo, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import Category from '#models/category'
import OrderItem from '#models/order_item'
import Tag from '#models/tag'

export default class Product extends ProductSchema {
  @belongsTo(() => Category)
  declare category: BelongsTo<typeof Category>

  @manyToMany(() => Tag, { pivotTable: 'product_tag' })
  declare tags: ManyToMany<typeof Tag>

  @hasMany(() => OrderItem)
  declare orderItems: HasMany<typeof OrderItem>

  get isLowStock() {
    return this.stock < 10
  }
}
