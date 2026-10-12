import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assert } from '@japa/assert'
import { fileSystem } from '@japa/file-system'
import { configure, processCLIArgs, run } from '@japa/runner'

processCLIArgs(process.argv.splice(2))

/**
 * Test apps live outside the monorepo, so module resolution can't climb
 * into the workspace's own node_modules.
 */
configure({
  files: ['tests/**/*.spec.ts'],
  plugins: [assert(), fileSystem({ basePath: join(tmpdir(), 'azu-core-tests') })],
})

run()
