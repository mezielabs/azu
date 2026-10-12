import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'product_tag'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('product_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('products')
        .onDelete('CASCADE')
      table
        .integer('tag_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('tags')
        .onDelete('CASCADE')
      table.unique(['product_id', 'tag_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
