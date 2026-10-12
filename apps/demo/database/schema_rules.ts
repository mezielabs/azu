import { type SchemaRules } from '@adonisjs/lucid/types/schema_generator'

/**
 * Narrow string columns that hold a fixed set of values, so the
 * generated schema classes carry union types instead of `string`.
 */
export default {
  tables: {
    users: {
      columns: {
        role: { tsType: `'admin' | 'staff' | 'customer'` },
      },
    },
    products: {
      columns: {
        status: { tsType: `'draft' | 'published'` },
      },
    },
    orders: {
      columns: {
        status: { tsType: `'pending' | 'paid' | 'shipped' | 'cancelled'` },
      },
    },
  },
} satisfies SchemaRules
