import { createInertiaApp } from '@inertiajs/react'
import type { ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import { packagePages, type PageModule } from './pages/index.ts'
import { RegistryProvider, type ComponentModules } from './components/registry.tsx'

export type CreateAzuAppOptions = {
  /**
   * The app's page overrides, from
   * `import.meta.glob('./pages/**\/*.tsx')`. Keys are file paths relative
   * to `inertia/admin/`.
   */
  pages?: Record<string, () => Promise<unknown>>
  /**
   * The app's custom components, from
   * `import.meta.glob('./components/**\/*.tsx', { eager: true })`.
   */
  components?: Record<string, unknown>
}

/**
 * `./pages/resource/index.tsx` → `resource/index`
 */
function pageKey(path: string) {
  return path.replace(/^\.\/pages\//, '').replace(/\.[jt]sx?$/, '')
}

/**
 * Boots the admin Inertia app. Server pages are named `azu/<page>`; the
 * app's copy wins over the package's.
 */
export function createAzuApp(options: CreateAzuAppOptions = {}) {
  const overrides = Object.fromEntries(
    Object.entries(options.pages ?? {}).map(([path, load]) => [
      pageKey(path),
      load as () => Promise<PageModule>,
    ])
  )

  return createInertiaApp({
    title: (title) => (title ? `${title} · Admin` : 'Admin'),
    resolve: async (name) => {
      const key = name.replace(/^azu\//, '')
      const load = overrides[key] ?? packagePages[key]
      if (!load) {
        throw new Error(`Azu page "${name}" not found in the app or in @mezielabs/azu-react`)
      }
      const page = await load()
      return page.default as ComponentType
    },
    setup({ el, App, props }) {
      createRoot(el).render(
        <RegistryProvider modules={(options.components ?? {}) as ComponentModules}>
          <App {...props} />
        </RegistryProvider>
      )
    },
  })
}
