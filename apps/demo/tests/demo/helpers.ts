import ace from '@adonisjs/core/services/ace'
import drive from '@adonisjs/drive/services/main'
import limiter from '@adonisjs/limiter/services/main'
import User from '#models/user'
import DemoReset from '#commands/demo_reset'
import demo, { type DemoRole } from '#config/demo'

/**
 * Runs `node ace demo:reset` against a fake uploads disk, so it never
 * empties the developer's real `storage` directory.
 */
export async function runDemoReset() {
  drive.fake()
  try {
    await ace.boot()
    ace.ui.switchMode('raw')
    const command = await ace.create(DemoReset, [])
    await command.exec()
    return command
  } finally {
    drive.restore()
  }
}

/**
 * The seeded account behind "Sign in as …"
 */
export function demoAccount(role: DemoRole) {
  return User.findByOrFail('email', demo.accounts[role])
}

/**
 * Forgets the write counts, so one test's requests don't throttle the next
 */
export function clearRateLimits() {
  return limiter.clear()
}
