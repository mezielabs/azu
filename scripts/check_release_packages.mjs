/** Inspect the actual pnpm tarballs before upload or publication. No registry writes. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const directory = resolve(process.argv[2] ?? 'artifacts/packages')
const core = JSON.parse(readFileSync(resolve(root, 'packages/core/package.json'), 'utf8'))
const react = JSON.parse(readFileSync(resolve(root, 'packages/react/package.json'), 'utf8'))
assert.match(core.version, /^\d+\.\d+\.\d+-preview\.\d+$/, 'Only preview versions are supported')
assert.equal(react.version, core.version, 'Packages must share one preview version')
if (process.env.AZU_RELEASE_VERSION) {
  assert.equal(
    core.version,
    process.env.AZU_RELEASE_VERSION,
    'Requested version must match manifests'
  )
}

const expected = [core, react].map(
  (pkg) => `${pkg.name.slice(1).replace('/', '-')}-${pkg.version}.tgz`
)
assert.deepEqual(
  readdirSync(directory)
    .filter((file) => file.endsWith('.tgz'))
    .sort(),
  expected.toSorted(),
  'Expected exactly the two current-version tarballs; remove stale archives'
)
const reports = []
for (const [index, source] of [core, react].entries()) {
  const archive = resolve(directory, expected[index])
  const files = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).trim().split('\n')
  const manifest = JSON.parse(
    execFileSync('tar', ['-xOf', archive, 'package/package.json'], { encoding: 'utf8' })
  )
  assert.equal(manifest.name, source.name)
  assert.equal(manifest.version, core.version)
  assert.deepEqual(manifest.repository, source.repository)
  assert.equal(manifest.repository.url, 'git+https://github.com/mezielabs/azu.git')
  assert.equal(manifest.homepage, source.homepage)
  assert.deepEqual(manifest.bugs, source.bugs)
  assert.ok(manifest.keywords.length > 0)
  assert.equal(manifest.publishConfig.access, 'public')
  assert.equal(manifest.publishConfig.provenance, true)
  assert.equal(manifest.license, 'MIT')
  assert.ok(
    !JSON.stringify(manifest).includes('workspace:'),
    'Packed manifest must not contain workspace protocols'
  )
  if (index === 1) assert.equal(manifest.peerDependencies['@mezielabs/azu'], `^${core.version}`)
  for (const file of files) {
    assert.ok(
      file.startsWith('package/') && !file.split('/').includes('..'),
      `Unexpected archive path: ${file}`
    )
    // tsdown emits the existing Luxon runtime bundle under build/node_modules.
    // Permit that single compiled dependency, never an installed dependency tree.
    const bundledLuxon =
      index === 0 &&
      /^package\/build\/node_modules\/(?:\.pnpm\/luxon@[^/]+\/node_modules\/)?luxon\/build\/es6\/luxon\.js$/.test(
        file
      )
    assert.ok(
      bundledLuxon ||
        !/(^|\/)(node_modules|tests?|coverage|\.git)(\/|$)|(^|\/)\.env(?:\.|$)|\.(map|tsbuildinfo)$/.test(
          file
        ),
      `Development or private file in archive: ${file}`
    )
  }
  const required = ['README.md', 'LICENSE.md', 'package.json']
  function exportPaths(value) {
    if (typeof value === 'string') required.push(value.replace(/^\.\//, ''))
    else for (const nested of Object.values(value)) exportPaths(nested)
  }
  exportPaths(manifest.exports)
  if (index === 0)
    required.push(
      'THIRD_PARTY_NOTICES.md',
      'build/configure.js',
      'build/commands/commands.json',
      'build/stubs/config/azu.stub',
      'build/stubs/start/azu.stub',
      'build/stubs/inertia/admin/app.stub',
      'build/stubs/make/admin_action.stub',
      'build/stubs/make/screen.stub',
      'build/stubs/make/screen_component.stub',
      'build/stubs/make/screen_form.stub',
      'build/stubs/make/screen_validator.stub',
      'build/resources/views/admin.edge'
    )
  else
    required.push(
      'src/pages/resource/index.tsx',
      'src/pages/resource/create.tsx',
      'src/pages/resource/edit.tsx',
      'src/pages/resource/show.tsx',
      'src/pages/screen.tsx'
    )
  for (const file of required)
    assert.ok(files.includes(`package/${file}`), `${source.name} missing ${file}`)
  reports.push({
    name: manifest.name,
    version: manifest.version,
    archive: expected[index],
    files: files.length,
    bytes: readFileSync(archive).length,
    sha256: createHash('sha256').update(readFileSync(archive)).digest('hex'),
  })
}
const sourceDirty =
  execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim() !== ''
if (process.env.GITHUB_ACTIONS === 'true')
  assert.equal(sourceDirty, false, 'Release package source must be clean')
const report = {
  sourceDirty,
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  packages: reports,
}
writeFileSync(resolve(directory, 'verification.json'), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
