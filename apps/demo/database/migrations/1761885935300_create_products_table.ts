import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'products'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('category_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('categories')
        .onDelete('RESTRICT')
      table.string('name', 160).notNullable()
      table.string('sku', 40).notNullable().unique()
      table.text('description').nullable()
      table.decimal('price', 12, 2).notNullable()
      table.integer('stock').notNullable().defaultTo(0)
      table.enum('status', ['draft', 'published']).notNullable().defaultTo('draft')
      table.boolean('is_featured').notNullable().defaultTo(false)
      table.string('thumbnail').nullable()
      table.timestamp('published_at').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['status'])
      table.index(['price'])
      table.index(['created_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
