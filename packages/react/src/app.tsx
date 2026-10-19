import { createInertiaApp, router } from '@inertiajs/react'
import { RouterProvider } from 'react-aria-components'
import type { ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import { packagePages, type PageModule } from './pages/index.ts'
import { usedComponentNames } from '@mezielabs/azu/shared'
import {
  ComponentRegistry,
  RegistryProvider,
  type ComponentModules,
} from './components/registry.tsx'
import { ToastRegion } from './components/toast.tsx'

declare module 'react-aria-components' {
  interface RouterConfig {
    /** `document`: a full page load rather than an Inertia visit, e.g. to the app's site */
    routerOptions: { document?: boolean }
  }
}

export type CreateAzuAppOptions = {
  /**
   * The app's page overrides: `import.meta.glob('./pages/**\/*.tsx')`
   * from `inertia/admin/app.tsx`.
   */
  pages?: Record<string, () => Promise<unknown>>

  /**
   * The app's custom components: `import.meta.glob('./components/**\/*.tsx')`.
   * Each loads when a page that uses it opens, so none of them weigh on
   * the admin entry. An eager glob (`{ eager: true }`) works too.
   */
  components?: Record<string, unknown>
}

/**
 * `./pages/resource/index.tsx` → `resource/index`
 */
export function pageKey(path: string) {
  return path.replace(/^\.\/pages\//, '').replace(/\.[jt]sx?$/, '')
}

/**
 * Boots the admin Inertia app. The server renders pages named
 * `azu/<page>`; the app's copy in `inertia/admin/pages` wins over the
 * package's.
 */
export function createAzuApp(options: CreateAzuAppOptions = {}) {
  const overrides = Object.fromEntries(
    Object.entries(options.pages ?? {}).map(([path, load]) => [
      pageKey(path),
      load as () => Promise<PageModule>,
    ])
  )

  const registry = new ComponentRegistry((options.components ?? {}) as ComponentModules)

  return createInertiaApp({
    // The theme's brand colour, so the bar reads in light and dark
    progress: { color: 'var(--azu-brand)' },
    // The app's name (`brand.name` in config/admin.ts), from the root view
    title: (title) => {
      const name =
        document.querySelector<HTMLMetaElement>('meta[name="azu-app-name"]')?.content || 'Admin'
      return title ? `${title} · ${name}` : name
    },
    // The page, and the app components its props name, load together,
    // so a lazily registered component is ready when the page renders
    resolve: async (name, page) => {
      const key = name.replace(/^azu\//, '')
      const load = overrides[key] ?? packagePages[key]
      if (!load) {
        throw new Error(`Azu page "${name}" not found in the app or in @mezielabs/azu-react`)
      }
      const [module] = await Promise.all([
        load(),
        registry.preload(usedComponentNames(name, page?.props)),
      ])
      return module.default as ComponentType
    },
    setup({ el, App, props }) {
      createRoot(el).render(
        <RegistryProvider registry={registry}>
          {/* React Aria links (table rows with an href) navigate through Inertia */}
          <RouterProvider
            navigate={(href, options) =>
              options?.document ? window.location.assign(href) : router.visit(href)
            }
          >
            <App {...props} />
            <ToastRegion />
          </RouterProvider>
        </RegistryProvider>
      )
    },
  })
}
