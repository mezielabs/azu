import { TagSchema } from '#database/schema'
import { manyToMany } from '@adonisjs/lucid/orm'
import type { ManyToMany } from '@adonisjs/lucid/types/relations'
import Product from '#models/product'

export default class Tag extends TagSchema {
  @manyToMany(() => Product, { pivotTable: 'product_tag' })
  declare products: ManyToMany<typeof Product>
}
