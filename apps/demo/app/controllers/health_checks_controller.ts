import { HealthChecks, MemoryHeapCheck } from '@adonisjs/core/health'
import { DbCheck } from '@adonisjs/lucid/database'
import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'

const healthChecks = new HealthChecks().register([
  new DbCheck(db.connection()),
  new MemoryHeapCheck(),
])

/**
 * GET /health for the public demo's host (DEMO_MODE, DEPLOY.md): 200
 * when the database answers, 503 otherwise.
 */
export default class HealthChecksController {
  async handle({ response }: HttpContext) {
    const report = await healthChecks.run()
    if (report.isHealthy) return response.ok(report)
    return response.serviceUnavailable(report)
  }
}
