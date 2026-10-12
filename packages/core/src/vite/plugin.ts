import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import type { Plugin } from 'vite'
import { defaults } from '../define_config.ts'

/**
 * Options for the `azu()` Vite plugin.
 */
export type AzuVitePluginOptions = {
  /**
   * The admin entry, relative to the app root. Must match `entry` in
   * `config/admin.ts`.
   *
   * @default 'inertia/admin/app.tsx'
   */
  entry?: string

  /**
   * Packages Vite must load exactly once, such as `react`. Defaults to
   * the peer dependencies of the installed Azu front-end package, so the
   * admin and the app never end up with two copies of React or Inertia.
   */
  dedupe?: string[]
}

/**
 * Azu front-end packages, in the order the plugin looks for them.
 */
const FRONT_END_PACKAGES = ['@mezielabs/azu-react']

/**
 * Finds `node_modules/<name>/package.json` from `root` upwards, the way
 * Node resolves packages. Read from disk each time rather than through
 * `require`, whose cache would keep a stale copy.
 */
function findPackageJson(root: string, name: string): string | undefined {
  let dir = root
  while (true) {
    const candidate = join(dir, 'node_modules', name, 'package.json')
    if (existsSync(candidate)) return candidate
    const parent = dirname(dir)
    if (parent === dir) return undefined
    dir = parent
  }
}

/**
 * What a front-end package declares in the `azu` field of its
 * package.json, so this plugin needs no knowledge of React or Tiptap.
 *
 * SPIKE (Phase 1 UI check): `optimizeDeps` and `optionalFeatures` are
 * being trialled; see docs/ui-check.md.
 */
type FrontEndManifest = {
  peerDependencies?: Record<string, string>
  azu?: {
    /** The package's own dependencies to pre-bundle in dev */
    optimizeDeps?: string[]
    /**
     * Lazily loaded features that need optional peers. When a peer is
     * missing, `specifier` is aliased to `fallback` so the app still
     * builds.
     */
    optionalFeatures?: {
      name: string
      specifier: string
      fallback: string
      requires: string[]
      optimizeDeps?: string[]
    }[]
  }
}

function readFrontEnd(root: string): { name: string; manifest: FrontEndManifest } | undefined {
  for (const name of FRONT_END_PACKAGES) {
    const file = findPackageJson(root, name)
    if (file) return { name, manifest: JSON.parse(readFileSync(file, 'utf8')) as FrontEndManifest }
  }
  return undefined
}

/**
 * Reads the peer dependencies of the first Azu front-end package
 * installed in the app. Azu's own packages are left out.
 */
export function frontEndPeers(root: string): string[] {
  const frontEnd = readFrontEnd(root)
  if (!frontEnd) return []
  return Object.keys(frontEnd.manifest.peerDependencies ?? {}).filter(
    (dep) => !dep.startsWith('@mezielabs/')
  )
}

/**
 * Aliases for optional features whose peers aren't installed, and the
 * dependencies to pre-bundle so dev never re-optimizes and reloads the
 * page the first time an admin page or lazy feature loads.
 */
export function frontEndFeatures(root: string) {
  const frontEnd = readFrontEnd(root)
  const alias: { find: string; replacement: string }[] = []
  const include: string[] = []
  if (!frontEnd) return { alias, include, missing: [] as string[] }

  const missing: string[] = []
  for (const dep of frontEnd.manifest.azu?.optimizeDeps ?? []) {
    include.push(`${frontEnd.name} > ${dep}`)
  }
  for (const feature of frontEnd.manifest.azu?.optionalFeatures ?? []) {
    const installed = feature.requires.every((dep) => findPackageJson(root, dep))
    if (installed) {
      include.push(...(feature.optimizeDeps ?? []))
    } else {
      alias.push({ find: feature.specifier, replacement: feature.fallback })
      missing.push(feature.name)
    }
  }
  return { alias, include, missing }
}

/**
 * Adds Azu's admin entry to the client build, so the admin bundle is
 * separate from the app's and public pages load none of it.
 *
 * It contributes to `environments.client.build.rolldownOptions.input`
 * rather than `build.*.input`: the `@adonisjs/vite` plugin uses
 * `build.*.input` in place of its `entryPoints` when set, while Vite
 * concatenates the environment inputs. So the app's entries stay.
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import { azu } from '@mezielabs/azu/vite'
 *
 * export default defineConfig({
 *   plugins: [react(), adonisjs({ entryPoints: ['inertia/app.tsx'] }), azu()],
 * })
 * ```
 */
export function azu(options: AzuVitePluginOptions = {}): Plugin {
  const entry = options.entry ?? defaults.entry

  return {
    name: 'azu',
    config(userConfig) {
      const root = userConfig.root ? resolve(userConfig.root) : process.cwd()
      const features = frontEndFeatures(root)
      return {
        resolve: { dedupe: options.dedupe ?? frontEndPeers(root), alias: features.alias },
        optimizeDeps: { include: features.include },
        environments: { client: { build: { rolldownOptions: { input: [entry] } } } },
      }
    },
  }
}
