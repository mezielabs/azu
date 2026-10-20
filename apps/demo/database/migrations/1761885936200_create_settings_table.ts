import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * The store's settings, one row per key (FR-23). `value` holds text and
 * `type` says how to read it back, so a boolean stays a boolean and a
 * datetime a datetime. Azu never owns this table: the Store settings
 * screen reads and writes it through the Setting model.
 */
export default class extends BaseSchema {
  protected tableName = 'settings'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('key', 64).notNullable().unique()
      table.enum('type', ['string', 'number', 'boolean', 'datetime']).notNullable()
      table.text('value').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
