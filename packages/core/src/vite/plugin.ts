import { resolve, sep } from 'node:path'
import type { Plugin } from 'vite'
import { defaults } from '../define_config.ts'
import { frontEndFeatures, frontEndIcons, frontEndPeers } from './front_end.ts'
import { iconsModule, usedIconNames } from './icons.ts'

/** The generated icons module's id */
const ICONS_MODULE = '\0azu:icons'

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

  /**
   * Where the app's resources are, relative to the app root. The plugin
   * reads their `icon:` names to bundle those icons and no others. Must
   * match `resources.autoload` in `config/admin.ts`.
   *
   * @default 'app/admin/resources'
   */
  resources?: string

  /**
   * More icon names to bundle, for resources that set `icon` in a way
   * the plugin can't read from their source (a variable, say).
   */
  icons?: string[]
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
  let root = process.cwd()
  let icons: ReturnType<typeof frontEndIcons>
  let bundledIcons = ''
  const resourcesDir = () =>
    resolve(root, options.resources ?? (defaults.resources.autoload as string))

  return {
    name: 'azu',
    config(userConfig) {
      root = userConfig.root ? resolve(userConfig.root) : process.cwd()
      icons = frontEndIcons(root)
      const features = frontEndFeatures(root)
      return {
        resolve: { dedupe: options.dedupe ?? frontEndPeers(root), alias: features.alias },
        optimizeDeps: { include: features.include },
        environments: { client: { build: { rolldownOptions: { input: [entry] } } } },
      }
    },

    /**
     * Navigation icons (FR-16). Without the icon package, the front-end
     * package's own empty module stays, and the navigation has none.
     */
    resolveId: {
      // Before Vite's own resolver, which would find the package's file
      order: 'pre',
      handler(id) {
        return icons && id === icons.specifier ? ICONS_MODULE : undefined
      },
    },

    load(id) {
      if (id !== ICONS_MODULE || !icons) return
      const found: { name: string; file: string }[] = []
      const names = usedIconNames(resourcesDir(), options.icons)
      bundledIcons = names.join(',')
      for (const name of names) {
        const file = icons.file(name)
        if (file) found.push({ name, file })
        else this.warn(`Unknown icon "${name}" in your admin resources; it shows no icon`)
      }
      return iconsModule(found)
    },

    /**
     * In dev, a resource edit that changes the icons in use reloads the
     * admin with the new set
     */
    configureServer(server) {
      const dir = resourcesDir()
      server.watcher.add(dir)
      const refresh = (file: string) => {
        if (!icons || !file.startsWith(dir + sep)) return
        if (usedIconNames(dir, options.icons).join(',') === bundledIcons) return
        const graph = server.environments.client.moduleGraph
        const module = graph.getModuleById(ICONS_MODULE)
        if (!module) return
        graph.invalidateModule(module)
        server.ws.send({ type: 'full-reload' })
      }
      server.watcher.on('add', refresh)
      server.watcher.on('change', refresh)
      server.watcher.on('unlink', refresh)
    },
  }
}
