import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import drive from '@adonisjs/drive/services/main'
import { DateTime } from 'luxon'
import demo from '#config/demo'
import { recordDemoReset } from '#services/demo_reset'

/**
 * Resets the public demo (DEMO_MODE): empties the uploads disk, runs
 * `migration:fresh --seed`, then records the time for the banner. The
 * host runs it on first deploy and every hour (DEPLOY.md):
 *
 *   node ace demo:reset
 */
export default class DemoReset extends BaseCommand {
  static commandName = 'demo:reset'
  static description = 'Reset the public demo: empty uploads, fresh database, seed data'
  static options: CommandOptions = { startApp: true }

  async run() {
    if (!demo.enabled) {
      this.logger.error(
        'demo:reset only runs with DEMO_MODE=true. Locally, use: node ace migration:fresh --seed'
      )
      this.exitCode = 1
      return
    }

    await this.emptyUploads()

    const fresh = await this.kernel.exec('migration:fresh', ['--seed', '--force'])
    if (fresh.exitCode) {
      this.exitCode = fresh.exitCode
      this.error = fresh.error
      return
    }

    await recordDemoReset(DateTime.utc())
    this.logger.success('Demo reset')
  }

  /**
   * Deletes everything on the default disk. Entry by entry rather than
   * the disk's root, which may be a mounted volume that can't be removed.
   */
  private async emptyUploads() {
    const disk = drive.use()
    const { objects } = await disk.listAll('/')
    for (const entry of objects) {
      if (entry.isDirectory) await disk.deleteAll(entry.prefix)
      else await disk.delete(entry.key)
    }
  }
}
