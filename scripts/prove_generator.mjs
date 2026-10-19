/**
 * Proves the generator (FR-04) on every demo model, with zero hand
 * edits:
 *
 * 1. Copies the demo to apps/demo/tmp/generator-proof (git-ignored), and
 *    removes its admin resources, policies and tests. Its own validators
 *    stay, so the generator meets name clashes (app/validators/user.ts).
 * 2. Runs `node ace azu:resource <Model> --policy` for every model.
 * 3. Type-checks the copy: the generated files must compile.
 * 4. Runs scripts/generator_proof/proof.spec.ts there: every generated
 *    resource must list, create, show and edit.
 *
 * Uses the database the environment names (DB_CONNECTION and friends),
 * like `pnpm test`. Run `pnpm build` first.
 */
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const demo = join(root, 'apps/demo')
const proof = join(demo, 'tmp/generator-proof')
const EXCLUDE = new Set(['node_modules', 'tmp', 'storage', 'build'])

function run(command, args, env = {}) {
  console.log(`\n$ ${command} ${args.join(' ')}`)
  const result = spawnSync(command, args, {
    cwd: proof,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  })
  if (result.status !== 0) {
    console.error(`\nGenerator proof failed at: ${command} ${args.join(' ')}`)
    process.exit(result.status ?? 1)
  }
}

rmSync(proof, { recursive: true, force: true })
mkdirSync(join(proof, 'tmp'), { recursive: true })
// Entry by entry: the copy lives inside the demo's own tmp directory
for (const entry of readdirSync(demo)) {
  if (EXCLUDE.has(entry)) continue
  cpSync(join(demo, entry), join(proof, entry), {
    recursive: true,
    filter: (source) => !relative(demo, source).startsWith('public/assets'),
  })
}

for (const dir of ['app/admin/resources', 'app/policies']) {
  for (const file of readdirSync(join(proof, dir))) rmSync(join(proof, dir, file))
}
rmSync(join(proof, 'tests/functional'), { recursive: true, force: true })
rmSync(join(proof, 'tests/types'), { recursive: true, force: true })
// The browser suite (axe checks) uses the hand-written resources too
rmSync(join(proof, 'tests/browser'), { recursive: true, force: true })
mkdirSync(join(proof, 'tests/functional'), { recursive: true })
cpSync(
  join(root, 'scripts/generator_proof/proof.spec.ts'),
  join(proof, 'tests/functional/generator_proof.spec.ts')
)

const models = readdirSync(join(proof, 'app/models'))
  .filter((file) => file.endsWith('.ts'))
  .map((file) =>
    file
      .replace(/\.ts$/, '')
      .split('_')
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join('')
  )

// Codegen indexes (controllers, policies) without the removed files
run('node', ['ace', 'codegen'])

// The generator reads the database, so migrate the test database first
run('node', ['ace', 'migration:run', '--force'], { NODE_ENV: 'test' })
for (const model of models) {
  run('node', ['ace', 'azu:resource', model, '--policy'], { NODE_ENV: 'test' })
}
// No rollback: on Postgres it would regenerate database/schema.ts from an
// empty database. The test run rolls back when it ends.

run('node', ['ace', 'codegen'])
const tsc = join(demo, 'node_modules/.bin/tsc')
run(existsSync(tsc) ? tsc : 'tsc', ['--noEmit'])
run('node', ['ace', 'test', 'functional'])

// Kept when a step fails, for debugging
rmSync(proof, { recursive: true, force: true })
console.log(`\nGenerator proof passed for ${models.length} models: ${models.join(', ')}`)
