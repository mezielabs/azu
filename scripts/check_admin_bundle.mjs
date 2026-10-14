/**
 * Checks the demo's production build against the admin bundle budget
 * (spec §2, docs/decisions.md):
 *
 * - initial admin JS (the admin entry and its static imports) ≤ 120 kB gz
 * - each page's lazy chunk (what it loads beyond the initial JS) ≤ 160 kB gz
 * - each azu() optional feature's chunk, such as the Tiptap editor, ≤ 200 kB gz.
 *   Features are the front-end package's `azu.optionalFeatures`, and their
 *   fallbacks, from its package.json.
 *
 * kB is 1,000 bytes, gzip at zlib's default level, as Vite reports sizes.
 *
 * Usage: node scripts/check_admin_bundle.mjs [assetsDir] [entry]
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const assetsDir = process.argv[2] ?? 'apps/demo/public/assets'
const entry = process.argv[3] ?? 'inertia/admin/app.tsx'
const BUDGET = { initial: 120, lazy: 160, feature: 200 }
const FRONT_END = process.argv[4] ?? 'packages/react/package.json'

const manifest = JSON.parse(readFileSync(join(assetsDir, '.vite/manifest.json'), 'utf8'))
if (!manifest[entry]?.isEntry) {
  console.error(`"${entry}" is not an entry in ${assetsDir}/.vite/manifest.json`)
  process.exit(1)
}

const sizes = new Map()
function gzipKb(file) {
  if (!sizes.has(file)) sizes.set(file, gzipSync(readFileSync(join(assetsDir, file))).length / 1000)
  return sizes.get(file)
}

/**
 * The manifest keys a chunk pulls in statically, itself included
 */
function staticClosure(key, seen = new Set()) {
  if (seen.has(key)) return seen
  seen.add(key)
  for (const imported of manifest[key].imports ?? []) staticClosure(imported, seen)
  return seen
}

const total = (keys) => [...keys].reduce((sum, key) => sum + gzipKb(manifest[key].file), 0)

const initial = staticClosure(entry)
const initialKb = total(initial)

/**
 * Every lazily loaded unit reachable from the admin entry: pages, and
 * features pages load lazily (like the rich text editor)
 */
const lazy = new Map()
const queue = [...initial]
while (queue.length) {
  const key = queue.shift()
  for (const target of manifest[key].dynamicImports ?? []) {
    if (lazy.has(target) || initial.has(target)) continue
    const closure = staticClosure(target)
    const own = [...closure].filter((chunk) => !initial.has(chunk))
    lazy.set(target, total(own))
    queue.push(...closure)
  }
}

/**
 * Built files of the front end's optional features and their fallbacks,
 * e.g. `build/features/rich_text_editor.js`
 */
const frontEnd = JSON.parse(readFileSync(FRONT_END, 'utf8'))
const featureFiles = (frontEnd.azu?.optionalFeatures ?? []).flatMap((feature) =>
  [feature.specifier, feature.fallback].map((specifier) => {
    const subpath = `.${specifier.slice(frontEnd.name.length)}`
    const target = frontEnd.exports?.[subpath]
    return String(typeof target === 'string' ? target : target?.default).replace(/^\.\//, '')
  })
)
const isFeature = (key) => featureFiles.some((file) => key.endsWith(file))

const rows = [
  ['initial admin JS', initialKb, BUDGET.initial],
  ...[...lazy].map(([key, kb]) => [
    `${isFeature(key) ? 'feature' : 'lazy'} ${key.replace(/^.*node_modules\//, '').replace(/^(\.\.\/)+/, '')}`,
    kb,
    isFeature(key) ? BUDGET.feature : BUDGET.lazy,
  ]),
]

let failed = false
for (const [label, kb, budget] of rows) {
  const ok = kb <= budget
  failed ||= !ok
  console.log(
    `${ok ? 'ok  ' : 'OVER'}  ${kb.toFixed(1).padStart(7)} kB gz / ${budget} kB  ${label}`
  )
}

if (failed) {
  console.error('\nAdmin bundle over budget (spec §2). See docs/decisions.md before raising it.')
  process.exit(1)
}
