import { CouponSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Category from '#models/category'

export default class Coupon extends CouponSchema {
  /**
   * The category the coupon is limited to; none means every product
   */
  @belongsTo(() => Category)
  declare category: BelongsTo<typeof Category>
}
