import { resolve } from 'node:path'
import type { Plugin } from 'vite'
import { defaults } from '../define_config.ts'
import { frontEndFeatures, frontEndPeers } from './front_end.ts'

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
 * Adds Azu's admin entry to the client build, so the admin bundle is
 * separate from the app's and public pages load none of it.
 *
 * It contributes to `environments.client.build.rolldownOptions.input`
 * rather than `build.*.input`: the `@adonisjs/vite` plugin uses
 * `build.*.input` in place of its `entryPoints` when set, while Vite
 * concatenates the environment inputs. So the app's entries stay.
 *
 * It also reads the front-end package's `azu` manifest: optional
 * features whose peers aren't installed are aliased to their fallbacks,
 * so an app without, say, Tiptap still builds. The package's
 * dependencies and installed feature peers are pre-bundled, so dev never
 * reloads the page the first time they load.
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
