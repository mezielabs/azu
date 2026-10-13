import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * The admin list searches products with ILIKE '%term%' on name and sku.
 * A leading wildcard can't use a B-tree index, so on Postgres these are
 * trigram (pg_trgm) GIN indexes, which ILIKE uses directly. Without
 * them, a search scans every row (about 600 ms p95 at 100,000 products).
 * Other databases skip this migration.
 */
export default class extends BaseSchema {
  async up() {
    if (this.db.dialect.name !== 'postgres') return
    this.schema.raw('CREATE EXTENSION IF NOT EXISTS pg_trgm')
    this.schema.raw(
      'CREATE INDEX products_name_trgm_index ON products USING gin (name gin_trgm_ops)'
    )
    this.schema.raw('CREATE INDEX products_sku_trgm_index ON products USING gin (sku gin_trgm_ops)')
  }

  async down() {
    if (this.db.dialect.name !== 'postgres') return
    this.schema.raw('DROP INDEX IF EXISTS products_sku_trgm_index')
    this.schema.raw('DROP INDEX IF EXISTS products_name_trgm_index')
  }
}
