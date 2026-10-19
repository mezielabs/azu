import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * `icon: 'package'` in a resource, screen or navigation link. Icon names
 * are kebab case, as Lucide names its icons.
 */
const ICON = /\bicon\s*:\s*(['"`])([a-z0-9]+(?:-[a-z0-9]+)*)\1/g

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  // A single file, such as config/azu.ts
  if (!statSync(dir).isDirectory()) return [dir]
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(m?[jt]s)$/.test(entry) ? [path] : []
  })
}

/**
 * The icon names the app's resources, screens and navigation links use,
 * read from their source (`dirs`: directories or files), plus any listed
 * in the plugin's `icons` option (for names set in code the scan can't
 * follow). Sorted, without repeats.
 */
export function usedIconNames(dirs: string | string[], extra: string[] = []): string[] {
  const names = new Set(extra)
  for (const file of [dirs].flat().flatMap(sourceFiles)) {
    for (const match of readFileSync(file, 'utf8').matchAll(ICON)) names.add(match[2])
  }
  return [...names].sort()
}

/**
 * The module that replaces the front-end package's empty icons module:
 * one import per icon in use, so the bundle holds no others.
 */
export function iconsModule(icons: { name: string; file: string }[]): string {
  const imports = icons.map(({ file }, index) => `import icon${index} from ${JSON.stringify(file)}`)
  const entries = icons.map(({ name }, index) => `  ${JSON.stringify(name)}: icon${index},`)
  return [...imports, '', 'export default {', ...entries, '}', ''].join('\n')
}
