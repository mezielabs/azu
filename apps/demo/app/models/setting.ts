import { SettingSchema } from '#database/schema'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

/**
 * The store's settings and their types. Every key can be unset (`null`).
 * Decimals stay exact strings, as in decimal columns.
 */
export type SettingValues = {
  storeName: string | null
  supportEmail: string | null
  currency: string | null
  vatRate: string | null
  maintenanceMode: boolean | null
  checkoutAnnouncement: string | null
  lastChangedAt: DateTime | null
}

export type SettingKey = keyof SettingValues

type StoredType = 'string' | 'number' | 'boolean' | 'datetime'

function typeOf(value: unknown): StoredType {
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return 'number'
  if (DateTime.isDateTime(value)) return 'datetime'
  return 'string'
}

function encode(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (DateTime.isDateTime(value)) return value.toUTC().toISO()
  return String(value)
}

function decode(type: StoredType, value: string | null): unknown {
  if (value === null) return null
  switch (type) {
    case 'boolean':
      return value === 'true'
    case 'number':
      return Number(value)
    case 'datetime':
      return DateTime.fromISO(value, { zone: 'utc' })
    default:
      return value
  }
}

/**
 * A key/value settings table (FR-23), with each value's type kept.
 */
export default class Setting extends SettingSchema {
  /**
   * The values of `keys`, typed; a key with no row is `null`.
   */
  static async values<K extends SettingKey>(keys: K[]): Promise<Pick<SettingValues, K>> {
    const rows = await this.query().whereIn('key', keys)
    const stored = new Map(rows.map((row) => [row.key, decode(row.type as StoredType, row.value)]))
    return Object.fromEntries(keys.map((key) => [key, stored.get(key) ?? null])) as Pick<
      SettingValues,
      K
    >
  }

  /**
   * Writes the given keys, in one transaction. `undefined` leaves a key
   * as it is; `null` clears it and keeps its type.
   */
  static async store(input: Partial<SettingValues>): Promise<void> {
    await db.transaction(async (trx) => {
      for (const [key, value] of Object.entries(input)) {
        if (value === undefined) continue
        const row = await this.query({ client: trx }).where('key', key).first()
        const type = value === null && row ? row.type : typeOf(value)
        if (row) {
          row.merge({ type, value: encode(value) })
          await row.useTransaction(trx).save()
        } else {
          await this.create({ key, type, value: encode(value) }, { client: trx })
        }
      }
    })
  }
}
