import { Logger } from '@adonisjs/core/logger'
import { Database } from '@adonisjs/lucid/database'

/**
 * A database for tests that query differently per dialect. `DB_CONNECTION`
 * (`pg` or `mysql`, with `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` and
 * `DB_DATABASE`) picks the server CI's matrix runs; otherwise an in-memory
 * SQLite database. Tests on a server create their own tables and drop them.
 */
export function testDatabase(name: string): Database {
  const env = process.env
  const which =
    env.DB_CONNECTION === 'pg' || env.DB_CONNECTION === 'mysql' ? env.DB_CONNECTION : 'sqlite'
  const server = (port: number) => ({
    host: env.DB_HOST ?? '127.0.0.1',
    port: Number(env.DB_PORT ?? port),
    user: env.DB_USER ?? 'azu',
    password: env.DB_PASSWORD ?? '',
    database: env.DB_DATABASE ?? 'azu_test',
  })
  const connections = {
    sqlite: {
      client: 'better-sqlite3' as const,
      connection: { filename: ':memory:' },
      useNullAsDefault: true,
    },
    pg: { client: 'pg' as const, connection: server(5432) },
    mysql: { client: 'mysql2' as const, connection: server(3306) },
  }
  return new Database(
    { connection: which, connections: { [which]: connections[which] } },
    new Logger({ name, enabled: false }),
    { emit() {}, hasListeners: () => false } as never
  )
}
