import drive from '@adonisjs/drive/services/main'
import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DateTime } from 'luxon'
import Category from '#models/category'
import Coupon from '#models/coupon'
import Order from '#models/order'
import Product from '#models/product'
import Setting from '#models/setting'
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
 * Ten product names per category, in the categories' order.
 */
const PRODUCT_NAMES: Record<string, string[]> = {
  Kitchen: [
    'Clay cooking pot',
    'Cast iron skillet',
    'Wooden spoon set',
    'Enamel stock pot',
    'Bamboo chopping board',
    'Stainless steel kettle',
    'Mortar and pestle',
    'Ceramic serving bowl',
    'Non-stick frying pan',
    'Spice rack',
  ],
  Fashion: [
    'Ankara wrap dress',
    'Aso-oke head tie',
    'Beaded necklace',
    'Leather sandals',
    'Adire kaftan',
    'Woven raffia bag',
    'Agbada set',
    'Coral bead bracelet',
    'Kente scarf',
    'Brass cuff',
  ],
  Electronics: [
    'Bluetooth speaker',
    'Solar power bank',
    'Wireless earbuds',
    'Rechargeable fan',
    'Smart plug',
    'USB-C charger',
    'LED desk lamp',
    'Portable radio',
    'Phone tripod',
    'Surge protector',
  ],
  Books: [
    'Things Fall Apart',
    'Half of a Yellow Sun',
    'The Famished Road',
    'Stay With Me',
    'Purple Hibiscus',
    'Americanah',
    'Freshwater',
    'My Sister, the Serial Killer',
    'An Orchestra of Minorities',
    'Lagos Noir',
  ],
}

/** A thumbnail per category: a coloured tile with its initial */
const TILE_COLORS: Record<string, string> = {
  Kitchen: '#c2410c',
  Fashion: '#7c3aed',
  Electronics: '#0369a1',
  Books: '#15803d',
}

function thumbnail(category: string, index: number) {
  const color = TILE_COLORS[category] ?? '#52525b'
  const shade = 0.55 + (index % 5) * 0.09
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="${color}" fill-opacity="${shade.toFixed(2)}"/><text x="32" y="42" font-family="system-ui, sans-serif" font-size="28" font-weight="600" text-anchor="middle" fill="#fff">${category[0]}</text></svg>`
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
    // More customers, signed up over the last two months, so the
    // Overview's "New customers" compares with something (FR-24)
    const NAMES = [
      'Amina Yusuf',
      'Emeka Nwosu',
      'Funke Adeyemi',
      'Kelechi Obi',
      'Bisi Ade',
      'Musa Danjuma',
      'Ifeoma Nnaji',
      'Segun Ojo',
      'Zainab Bello',
      'Obinna Eze',
    ]
    for (const [index, fullName] of NAMES.entries()) {
      const [first] = fullName.toLowerCase().split(' ')
      customers.push(
        await User.create({
          fullName,
          email: `${first}@azu.test`,
          password: 'password',
          role: 'customer',
          createdAt: DateTime.now().minus({ days: 3 + index * 6 }),
        })
      )
    }

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
      const name = PRODUCT_NAMES[category.name][Math.floor((i - 1) / categories.length)]
      // Every fifth product has no image, so the list shows both
      const image = i % 5 === 0 ? null : `seed/products/${String(i).padStart(2, '0')}.svg`
      if (image) await drive.use().put(image, thumbnail(category.name, i))
      const product = await Product.create({
        categoryId: category.id,
        name,
        sku: `SKU-${String(i).padStart(4, '0')}`,
        description: i % 3 === 0 ? null : `<p>${name}, from the ${category.name} range.</p>`,
        price: toDecimal(priceMinor),
        stock: (i * 7) % 50,
        status: i % 4 === 0 ? 'draft' : 'published',
        isFeatured: i % 10 === 0,
        thumbnail: image,
        publishedAt: i % 4 === 0 ? null : DateTime.utc(2026, 9, 1).plus({ days: i }),
      })
      await product
        .related('tags')
        .attach([tags[i % tags.length].id, tags[(i + 2) % tags.length].id])
      products.push({ product, priceMinor })
    }

    const statuses = ['pending', 'paid', 'shipped', 'cancelled'] as const
    for (let i = 1; i <= 60; i++) {
      const customer = customers[i % customers.length]
      const lines = [products[i % products.length], products[(i * 3) % products.length]]
      const order = await Order.create({
        userId: customer.id,
        number: `AZU-${String(1000 + i)}`,
        status: statuses[i % statuses.length],
        total: toDecimal(lines.reduce((sum, line) => sum + line.priceMinor, 0)),
        // About one a day over the last two months, newest first, so the
        // Overview can compare a range with the one before
        placedAt: DateTime.now().minus({ hours: 2 + (i - 1) * 23 }),
      })
      await order.related('items').createMany(
        lines.map((line) => ({
          productId: line.product.id,
          quantity: 1,
          unitPrice: line.product.price,
        }))
      )
    }

    await Coupon.createMany([
      {
        code: 'WELCOME10',
        description: 'Ten percent off a first order',
        kind: 'percent',
        amount: '10.00',
        currency: 'NGN',
        usageLimit: null,
        isActive: true,
        startsOn: DateTime.fromISO('2026-10-01'),
        expiresAt: null,
      },
      {
        code: 'DETTY-DECEMBER',
        description: null,
        kind: 'fixed',
        amount: '5000.00',
        currency: 'NGN',
        usageLimit: 500,
        isActive: true,
        startsOn: DateTime.fromISO('2026-12-01'),
        expiresAt: DateTime.utc(2027, 1, 1, 0, 0),
      },
      {
        code: 'SHIPFREE',
        description: 'Free delivery in Lagos',
        kind: 'free_shipping',
        amount: '0.00',
        currency: 'NGN',
        usageLimit: 100,
        categoryId: categories[0].id,
        isActive: false,
        startsOn: DateTime.fromISO('2026-09-01'),
        expiresAt: DateTime.utc(2026, 9, 30, 22, 59),
      },
    ])

    // The Store settings screen's values (FR-23)
    await Setting.store({
      storeName: 'Azu Store',
      supportEmail: 'help@azu.test',
      currency: 'NGN',
      vatRate: '7.50',
      maintenanceMode: false,
      checkoutAnnouncement:
        '<p>Free delivery in Lagos on orders over <strong>NGN 50,000</strong>.</p>',
      lastChangedAt: DateTime.utc(2026, 10, 1, 9, 0),
    })
  }
}
