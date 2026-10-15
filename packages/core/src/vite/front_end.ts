import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * Azu front-end packages, in the order the plugin looks for them.
 */
const FRONT_END_PACKAGES = ['@mezielabs/azu-react']

/**
 * What a front-end package declares in the `azu` field of its
 * package.json, so `azu()` needs no knowledge of React, Tiptap or any
 * other front-end library. Internal and undocumented for now.
 */
type FrontEndManifest = {
  peerDependencies?: Record<string, string>
  azu?: {
    /**
     * The package's own dependencies to pre-bundle in dev, written
     * relative to the package (`react-aria-components`).
     */
    optimizeDeps?: string[]

    /**
     * Lazily loaded features that need optional peers. When any peer in
     * `requires` is missing, `specifier` is aliased to `fallback`, so
     * the app still builds.
     */
    optionalFeatures?: {
      name: string
      specifier: string
      fallback: string
      requires: string[]
      /** Installed peers to pre-bundle when the feature is available */
      optimizeDeps?: string[]
    }[]

    /**
     * Navigation icons (FR-16): `specifier` is replaced with a module of
     * the icons the app's resources name, each the default export of
     * `path` (with `{name}`) in `package`, when it's installed.
     */
    icons?: { specifier: string; package: string; path: string }
  }
}

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
 * The first Azu front-end package installed in the app.
 */
function readFrontEnd(root: string): { name: string; manifest: FrontEndManifest } | undefined {
  for (const name of FRONT_END_PACKAGES) {
    const file = findPackageJson(root, name)
    if (file) return { name, manifest: JSON.parse(readFileSync(file, 'utf8')) as FrontEndManifest }
  }
  return undefined
}

/**
 * Peer dependencies of the installed front-end package, which must be
 * loaded exactly once. Azu's own packages are left out.
 */
export function frontEndPeers(root: string): string[] {
  const frontEnd = readFrontEnd(root)
  if (!frontEnd) return []
  return Object.keys(frontEnd.manifest.peerDependencies ?? {}).filter(
    (dep) => !dep.startsWith('@mezielabs/')
  )
}

/**
 * Resolve aliases for optional features whose peers aren't installed,
 * and the dependencies to pre-bundle so dev never re-optimizes and
 * reloads the page the first time an admin page or a lazy feature loads.
 */
export function frontEndFeatures(root: string): {
  alias: { find: string; replacement: string }[]
  include: string[]
  missing: string[]
} {
  const alias: { find: string; replacement: string }[] = []
  const include: string[] = []
  const missing: string[] = []

  const frontEnd = readFrontEnd(root)
  if (!frontEnd) return { alias, include, missing }

  /**
   * Nested syntax, so pnpm apps resolve the package's own dependencies
   * without having them hoisted
   */
  for (const dep of frontEnd.manifest.azu?.optimizeDeps ?? []) {
    include.push(`${frontEnd.name} > ${dep}`)
  }

  for (const feature of frontEnd.manifest.azu?.optionalFeatures ?? []) {
    if (feature.requires.every((dep) => findPackageJson(root, dep))) {
      include.push(...(feature.optimizeDeps ?? []))
    } else {
      alias.push({ find: feature.specifier, replacement: feature.fallback })
      missing.push(feature.name)
    }
  }

  return { alias, include, missing }
}

/**
 * Where the front-end package's icons come from, when the icon package
 * is installed: the specifier to replace, and the file for an icon name
 * (`null` when the package has no such icon).
 */
export function frontEndIcons(
  root: string
): { specifier: string; file: (name: string) => string | null } | undefined {
  const icons = readFrontEnd(root)?.manifest.azu?.icons
  if (!icons) return undefined
  const manifest = findPackageJson(root, icons.package)
  if (!manifest) return undefined
  const dir = dirname(manifest)
  return {
    specifier: icons.specifier,
    file: (name) => {
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) return null
      const file = join(dir, icons.path.replace('{name}', name))
      return existsSync(file) ? file : null
    },
  }
}
