import app from '@adonisjs/core/services/app'
import type { AzuConfig } from '@mezielabs/azu/types'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import type Category from '#models/category'
import User from '#models/user'

/**
 * A user with the given role and a unique email, so tests don't depend
 * on seeded data.
 */
export function createUser(role: User['role']) {
  return User.create({
    fullName: `${role} tester`,
    email: `${role}-${randomUUID().slice(0, 8)}@azu.test`,
    password: 'secret-password',
    role,
  })
}

/**
 * Inserts `count` draft products in one category, 400 rows per statement
 * (SQLite allows 500 terms in the compound SELECT knex builds), so a test
 * can reach the chunk size and the limit quickly.
 */
export async function insertProducts(category: Category, count: number, name = 'Bulk pot') {
  const now = DateTime.now().toFormat(db.connection().dialect.dateTimeFormat)
  const prefix = randomUUID().slice(0, 8).toUpperCase()
  for (let start = 0; start < count; start += 400) {
    const rows = Array.from({ length: Math.min(400, count - start) }, (_, offset) => ({
      category_id: category.id,
      name,
      sku: `B-${prefix}-${start + offset}`,
      price: '5.00',
      stock: 2,
      status: 'draft',
      is_featured: false,
      created_at: now,
      updated_at: now,
    }))
    await db.table('products').multiInsert(rows)
  }
}

/**
 * Sets `home` in the demo's config/azu.ts for one test (FR-22): `null`
 * for the welcome page.
 */
export function withHome(home: AzuConfig['home'], cleanup: (callback: () => void) => void) {
  const config = app.config.get<AzuConfig>('azu')
  const before = config.home
  config.home = home
  cleanup(() => {
    config.home = before
  })
}
