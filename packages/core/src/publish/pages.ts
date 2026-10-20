import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import string from '@adonisjs/core/helpers/string'

/**
 * Azu's pages, as `azu:publish` names them (FR-15): the server's page
 * names without `azu/`.
 */
export const PAGE_NAMES = [
  'dashboard',
  'resource/index',
  'resource/create',
  'resource/edit',
  'resource/show',
  'errors/forbidden',
  'errors/not_found',
  'screen',
] as const

export type PageName = (typeof PAGE_NAMES)[number]

/**
 * A page name as a user types it: `resource/index`, `Resource/Index`,
 * `azu/resource/index` or `errors/NotFound`. `null` when Azu has no such
 * page.
 */
export function pageName(input: string): PageName | null {
  const name = input
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .replace(/^azu\//, '')
    .replace(/\.tsx$/, '')
    .split('/')
    .map((part) => string.snakeCase(part))
    .join('/')
  return (PAGE_NAMES as readonly string[]).includes(name) ? (name as PageName) : null
}

/** Where a published page lives, relative to the app root */
export function publishedPath(page: PageName): string {
  return `inertia/admin/pages/${page}.tsx`
}

export function sourceHash(source: string): string {
  return createHash('sha256').update(source).digest('hex')
}

const STAMP = /^\/\/ azu-publish: (\S+)@(\S+) sha256:([0-9a-f]{64})$/m

/**
 * What a published page carries: which page it is, the
 * `@mezielabs/azu-react` version it came from, and a hash of the
 * original, so `azu:doctor` can tell when a newer version changes it.
 */
export type PublishStamp = { page: string; version: string; hash: string }

/**
 * The page's source with a stamp on top. The stamp is a few line
 * comments, so the copy stays valid TSX and the original's own comments
 * follow unchanged.
 */
export function publishedSource(page: PageName, version: string, source: string): string {
  return [
    `// Published from @mezielabs/azu-react ${version} by \`node ace azu:publish ${page}\`.`,
    "// Azu renders this file instead of its own page, so it's yours to edit. After",
    '// upgrading Azu, run `node ace azu:doctor` to see whether the original changed.',
    `// azu-publish: ${page}@${version} sha256:${sourceHash(source)}`,
    source,
  ].join('\n')
}

export function readStamp(content: string): PublishStamp | null {
  const match = STAMP.exec(content)
  return match ? { page: match[1], version: match[2], hash: match[3] } : null
}

/**
 * The app's `@mezielabs/azu-react`: its version, and each page's
 * source, which the package ships in `src/pages`.
 */
export type ReactPackage = {
  version: string
  root: string
  pageFile(page: PageName): string
  pageSource(page: PageName): Promise<string | null>
}

/**
 * Finds `@mezielabs/azu-react` as Node would from the app root: in the
 * nearest `node_modules` that has it. Walked by hand, because Node's
 * resolver caches paths for the life of the process. `null` when it
 * isn't installed.
 */
export async function findReactPackage(appRoot: string): Promise<ReactPackage | null> {
  let manifest: string | null = null
  for (let dir = resolve(appRoot); ; dir = dirname(dir)) {
    const candidate = join(dir, 'node_modules', '@mezielabs', 'azu-react', 'package.json')
    if (existsSync(candidate)) {
      manifest = candidate
      break
    }
    if (dirname(dir) === dir) break
  }
  if (!manifest) return null

  const root = dirname(manifest)
  const { version } = JSON.parse(await readFile(manifest, 'utf8')) as { version: string }
  const pageFile = (page: PageName) => join(root, 'src', 'pages', `${page}.tsx`)
  return {
    version,
    root,
    pageFile,
    async pageSource(page) {
      try {
        return await readFile(pageFile(page), 'utf8')
      } catch {
        return null
      }
    },
  }
}
