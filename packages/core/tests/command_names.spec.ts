import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from '@japa/runner'

const ROOT = join(import.meta.dirname, '../../..')

/**
 * Names from before the `azu` ones, built from parts so this file
 * doesn't match itself: the commands, and the config and preload files
 * the package writes into the app
 */
const OLD_NAMES = [
  ...[
    ['make', 'admin-resource'],
    ['make', 'admin-action'],
    ['admin', 'publish'],
    ['admin', 'doctor'],
  ].map((parts) => parts.join(':')),
  ...[
    ['config', 'admin.ts'],
    ['start', 'admin.ts'],
    ['#start', 'admin'],
  ].map((parts) => parts.join('/')),
]

/** History may name them: decisions record what was true then */
const HISTORY = new Set(['docs/decisions.md'])

const BINARY = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|sqlite3?|lock)$/

test.group('Command names', () => {
  test('nothing in the repo uses the old command or file names', ({ assert }) => {
    const files = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
      .split('\n')
      .filter((file) => file && !HISTORY.has(file) && !BINARY.test(file))
    assert.isAbove(files.length, 100)

    const found: string[] = []
    for (const file of files) {
      let text: string
      try {
        text = readFileSync(join(ROOT, file), 'utf8')
      } catch {
        continue
      }
      text.split('\n').forEach((line, index) => {
        for (const name of OLD_NAMES) {
          if (line.includes(name)) found.push(`${file}:${index + 1}: ${name}`)
        }
      })
    }
    assert.deepEqual(
      found,
      [],
      'use azu:resource, azu:action, azu:publish, azu:doctor, config/azu.ts and start/azu.ts'
    )
  })
})
