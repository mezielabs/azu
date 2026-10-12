import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig } from '@adonisjs/lucid'

const dbConfig = defineConfig({
  /**
   * Default connection. SQLite needs no server, so it's the local
   * default; CI also runs the suite against Postgres (the primary
   * target) with DB_CONNECTION=pg.
   */
  connection: env.get('DB_CONNECTION', 'sqlite'),

  connections: {
    sqlite: {
      client: 'better-sqlite3',

      connection: {
        /**
         * Tests use their own file, so `node ace test` never touches
         * the dev database.
         */
        filename: app.tmpPath(app.inTest ? 'test.sqlite3' : 'db.sqlite3'),
      },

      /**
       * Required by Knex for SQLite defaults.
       */
      useNullAsDefault: true,

      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },

      /**
       * database/schema.ts is generated from SQLite. Postgres types
       * decimal columns differently (see docs/decisions.md), so
       * generation stays on this connection only.
       */
      schemaGeneration: {
        enabled: true,
        rulesPaths: ['./database/schema_rules.js'],
      },
    },

    pg: {
      client: 'pg',
      connection: {
        host: env.get('DB_HOST', '127.0.0.1'),
        port: env.get('DB_PORT', 5432),
        user: env.get('DB_USER', 'postgres'),
        password: env.get('DB_PASSWORD', ''),
        database: env.get('DB_DATABASE', 'azu_demo'),
      },
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
      schemaGeneration: {
        enabled: false,
      },
    },
  },
})

export default dbConfig
