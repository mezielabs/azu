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
 * Reads the peer dependencies of the first Azu front-end package
 * installed in the app. Azu's own packages are left out.
 */
export function frontEndPeers(root: string): string[] {
  for (const name of FRONT_END_PACKAGES) {
    const file = findPackageJson(root, name)
    if (!file) continue
    const pkg = JSON.parse(readFileSync(file, 'utf8')) as {
      peerDependencies?: Record<string, string>
    }
    return Object.keys(pkg.peerDependencies ?? {}).filter((dep) => !dep.startsWith('@mezielabs/'))
  }
  return []
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
      return {
        resolve: { dedupe: options.dedupe ?? frontEndPeers(root) },
        environments: { client: { build: { rolldownOptions: { input: [entry] } } } },
      }
    },
  }
}
