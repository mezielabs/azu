import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const source = resolve(process.env.AZU_PACK_TEST_DIR ?? join(root, 'artifacts/packages'))
const version = JSON.parse(readFileSync(join(root, 'packages/core/package.json'), 'utf8')).version
const archives = [`mezielabs-azu-${version}.tgz`, `mezielabs-azu-react-${version}.tgz`]
const checker = join(root, 'scripts/check_release_packages.mjs')

function rejected(index, mutate, message) {
  const temp = mkdtempSync(join(tmpdir(), 'azu-package-check-'))
  try {
    for (const name of archives) cpSync(join(source, name), join(temp, name))
    const archive = join(temp, archives[index])
    const files = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).trim().split('\n')
    const unpacked = join(temp, 'unpacked')
    mkdirSync(unpacked)
    execFileSync('tar', ['-xzf', archive, '-C', unpacked])
    mutate(join(unpacked, 'package'), files)
    execFileSync('tar', [
      '-czf',
      archive,
      '-C',
      unpacked,
      ...files.filter((file) => existsSync(join(unpacked, file))),
    ])
    const result = spawnSync(process.execPath, [checker, temp], { encoding: 'utf8' })
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, message)
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
}

test('rejects a packed workspace peer', () => {
  rejected(
    1,
    (directory) => {
      const file = join(directory, 'package.json')
      const pkg = JSON.parse(readFileSync(file, 'utf8'))
      pkg.peerDependencies['@mezielabs/azu'] = 'workspace:^'
      writeFileSync(file, JSON.stringify(pkg))
    },
    /must not contain workspace protocols/
  )
})

test('rejects a missing runtime template', () => {
  rejected(
    0,
    (directory) => unlinkSync(join(directory, 'build/resources/views/admin.edge')),
    /missing build\/resources\/views\/admin.edge/
  )
})

test('rejects an environment file in a tarball', () => {
  rejected(
    1,
    (directory, files) => {
      writeFileSync(join(directory, '.env'), 'EXAMPLE=fixture\n')
      files.push('package/.env')
    },
    /Development or private file in archive: package\/\.env/
  )
})

test('rejects a requested version that differs from the inspected packages', () => {
  const result = spawnSync(process.execPath, [checker, source], {
    encoding: 'utf8',
    env: { ...process.env, AZU_RELEASE_VERSION: '999.0.0-preview.0' },
  })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Requested version must match manifests/)
})
