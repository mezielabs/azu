/**
 * What an app needs before Azu can render its admin panel (#63, #64):
 * Vite, Edge, Inertia (its config and provider) and a session guard.
 * `configure` checks these before writing anything; the admin
 * middleware checks Inertia and Vite on each request.
 */

/** A missing piece, and exactly what to add */
export type MissingPrerequisite = {
  name: 'vite' | 'edge' | 'inertia config' | 'inertia provider' | 'session guard'
  /** One line on what's missing */
  problem: string
  /** What to run or add, in order */
  fix: string[]
}

/** The app's files `configure` reads, or `null` when a file is absent */
export type AppFiles = {
  /** `adonisrc.ts` */
  rcFile: string | null
  /** Whether `vite.config.ts` exists */
  viteConfig: boolean
  /** Whether `config/vite.ts`, the Vite provider's config, exists */
  viteProviderConfig: boolean
  /** Whether `config/inertia.ts` exists */
  inertiaConfig: boolean
  /** `config/auth.ts` */
  authConfig: string | null
}

const VITE_PROVIDER = '@adonisjs/vite/vite_provider'
const EDGE_PROVIDER = '@adonisjs/core/providers/edge_provider'
const INERTIA_PROVIDER = '@adonisjs/inertia/inertia_provider'

/** The config file an app without Inertia adds for the admin panel alone */
export const INERTIA_CONFIG_SNIPPET = `// config/inertia.ts
import { defineConfig } from '@adonisjs/inertia'

export default defineConfig({
  ssr: { enabled: false, entrypoint: 'inertia/ssr.tsx' },
})`

/** The two steps that add Inertia for /admin, without touching the app's pages */
export const INERTIA_STEPS = {
  config: `Add config/inertia.ts:\n${INERTIA_CONFIG_SNIPPET}`,
  provider: `Register the provider in adonisrc.ts: () => import('${INERTIA_PROVIDER}')`,
}

/** What `configure` found: pieces to add first, and things it couldn't confirm */
export type PrerequisiteCheck = {
  /** Configure refuses while any of these are missing */
  missing: MissingPrerequisite[]
  /** Providers not found in adonisrc.ts whose config file exists: configure warns and carries on */
  warnings: string[]
}

/**
 * Whether adonisrc.ts imports a provider: `import('…')` with either
 * quote style (or a backtick) and any whitespace or line breaks inside
 * the parentheses. Lines commented out with `//` don't count.
 */
export function registersProvider(rcFile: string | null, provider: string): boolean {
  if (rcFile === null) return false
  const source = rcFile.replace(/^\s*\/\/.*$/gm, '')
  const name = provider.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
  return new RegExp(`\\bimport\\s*\\(\\s*(['"\`])${name}\\1\\s*,?\\s*\\)`).test(source)
}

function unconfirmed(provider: string, configFile: string) {
  return `Couldn't find ${provider} in adonisrc.ts, but ${configFile} exists, so carrying on. If /admin fails to load, register it: () => import('${provider}')`
}

/**
 * Checks an app's files for what the admin panel needs. `missing` is
 * empty when Azu can be configured.
 */
export function checkPrerequisites(files: AppFiles): PrerequisiteCheck {
  const missing: MissingPrerequisite[] = []
  const warnings: string[] = []

  const viteProvider = registersProvider(files.rcFile, VITE_PROVIDER)
  if (!files.viteConfig || (!viteProvider && !files.viteProviderConfig)) {
    missing.push({
      name: 'vite',
      problem: 'Vite is not set up: Azu adds the admin panel as its own Vite entry',
      fix: ['node ace add @adonisjs/vite'],
    })
  } else if (!viteProvider) {
    warnings.push(unconfirmed(VITE_PROVIDER, 'config/vite.ts'))
  }
  // Edge has no config file to fall back on
  if (!registersProvider(files.rcFile, EDGE_PROVIDER)) {
    missing.push({
      name: 'edge',
      problem: "Edge is not set up: the admin panel's root view is an Edge template",
      fix: ['node ace add edge'],
    })
  }
  if (!files.inertiaConfig) {
    missing.push({
      name: 'inertia config',
      problem: 'config/inertia.ts is missing: Azu renders the admin panel with Inertia',
      fix: [INERTIA_STEPS.config],
    })
  }
  if (!registersProvider(files.rcFile, INERTIA_PROVIDER)) {
    if (files.inertiaConfig) {
      warnings.push(unconfirmed(INERTIA_PROVIDER, 'config/inertia.ts'))
    } else {
      missing.push({
        name: 'inertia provider',
        problem: "@adonisjs/inertia's provider is not registered",
        fix: [INERTIA_STEPS.provider],
      })
    }
  }
  if (!/\bsessionGuard\s*\(/.test(files.authConfig ?? '')) {
    missing.push({
      name: 'session guard',
      problem:
        "There is no session guard: the admin panel signs people in through your app's session login",
      fix: [
        'Add a session guard to config/auth.ts (sessionGuard from @adonisjs/auth/session), with a login page at the URL config/azu.ts names as loginUrl',
      ],
    })
  }
  return { missing, warnings }
}

/**
 * When the app's default guard isn't a session guard but another one
 * is (the API starter kit's "api" and "web"), the name to set as
 * `guard` in config/azu.ts. `null` otherwise.
 */
export function sessionGuardToUse(authConfig: string | null): string | null {
  if (!authConfig) return null
  const sessionGuards = [...authConfig.matchAll(/(\w+)\s*:\s*sessionGuard\(/g)].map(
    (match) => match[1]
  )
  const fallback = authConfig.match(/default\s*:\s*['"](\w+)['"]/)?.[1]
  if (!fallback || sessionGuards.length === 0 || sessionGuards.includes(fallback)) return null
  return sessionGuards[0]
}

/** The problem an admin request hits when the app can't render it */
export function runtimeSetupProblem(app: {
  hasInertiaConfig: boolean
  hasInertiaProvider: boolean
  hasVite: boolean
}): string | null {
  const steps: string[] = []
  if (!app.hasInertiaConfig) steps.push(INERTIA_STEPS.config)
  if (!app.hasInertiaProvider) steps.push(INERTIA_STEPS.provider)
  if (!app.hasVite) steps.push('Set up Vite: node ace add @adonisjs/vite')
  if (steps.length === 0) return null
  return [
    'Azu renders the admin panel with Inertia and Vite, and this app is missing part of that setup:',
    ...steps.map((step, index) => `${index + 1}. ${step}`),
    'See "Starter kits" in the @mezielabs/azu README.',
  ].join('\n')
}
