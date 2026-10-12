import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DateTime } from 'luxon'
import Category from '#models/category'
import Order from '#models/order'
import Product from '#models/product'
import Tag from '#models/tag'
import User from '#models/user'

/**
 * Decimal columns hold exact strings (Postgres returns them as strings),
 * so money is computed in integer minor units and formatted without
 * going through floating point: 175050 → '1750.50'.
 */
function toDecimal(minor: number) {
  return `${Math.trunc(minor / 100)}.${String(minor % 100).padStart(2, '0')}`
}

/**
 * Deterministic seed data for the demo store. Every login uses the
 * password "password".
 */
export default class MainSeeder extends BaseSeeder {
  async run() {
    const [admin, staff, ...customers] = await User.createMany([
      { fullName: 'Ada Admin', email: 'admin@azu.test', password: 'password', role: 'admin' },
      { fullName: 'Sam Staff', email: 'staff@azu.test', password: 'password', role: 'staff' },
      { fullName: 'Chidi Okafor', email: 'chidi@azu.test', password: 'password', role: 'customer' },
      { fullName: 'Ngozi Eze', email: 'ngozi@azu.test', password: 'password', role: 'customer' },
      { fullName: 'Tunde Bello', email: 'tunde@azu.test', password: 'password', role: 'customer' },
    ])
    void admin
    void staff

    const categories = await Category.createMany([
      { name: 'Kitchen', slug: 'kitchen', description: 'Pots, pans and everything in between' },
      { name: 'Fashion', slug: 'fashion', description: 'Ankara, aso-oke and accessories' },
      { name: 'Electronics', slug: 'electronics', description: null },
      { name: 'Books', slug: 'books', description: 'Fiction and non-fiction' },
    ])

    const tags = await Tag.createMany(
      ['new', 'sale', 'handmade', 'bestseller', 'gift'].map((name) => ({ name, slug: name }))
    )

    const products: { product: Product; priceMinor: number }[] = []
    for (let i = 1; i <= 40; i++) {
      const category = categories[i % categories.length]
      const priceMinor = (1500 + i * 250) * 100
      const product = await Product.create({
        categoryId: category.id,
        name: `${category.name} item ${i}`,
        sku: `SKU-${String(i).padStart(4, '0')}`,
        description: i % 3 === 0 ? null : `<p>Description for ${category.name} item ${i}</p>`,
        price: toDecimal(priceMinor),
        stock: (i * 7) % 50,
        status: i % 4 === 0 ? 'draft' : 'published',
        isFeatured: i % 10 === 0,
        thumbnail: null,
        publishedAt: i % 4 === 0 ? null : DateTime.utc(2026, 9, 1).plus({ days: i }),
      })
      await product
        .related('tags')
        .attach([tags[i % tags.length].id, tags[(i + 2) % tags.length].id])
      products.push({ product, priceMinor })
    }

    const statuses = ['pending', 'paid', 'shipped', 'cancelled'] as const
    for (let i = 1; i <= 20; i++) {
      const customer = customers[i % customers.length]
      const lines = [products[i % products.length], products[(i * 3) % products.length]]
      const order = await Order.create({
        userId: customer.id,
        number: `AZU-${String(1000 + i)}`,
        status: statuses[i % statuses.length],
        total: toDecimal(lines.reduce((sum, line) => sum + line.priceMinor, 0)),
        placedAt: DateTime.utc(2026, 10, 1).plus({ hours: i * 5 }),
      })
      await order.related('items').createMany(
        lines.map((line) => ({
          productId: line.product.id,
          quantity: 1,
          unitPrice: line.product.price,
        }))
      )
    }
  }
}
