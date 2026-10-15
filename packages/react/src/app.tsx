import { createInertiaApp, router } from '@inertiajs/react'
import { RouterProvider } from 'react-aria-components'
import type { ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import { packagePages, type PageModule } from './pages/index.ts'
import { RegistryProvider, type ComponentModules } from './components/registry.tsx'
import { ToastRegion } from './components/toast.tsx'

export type CreateAzuAppOptions = {
  /**
   * The app's page overrides: `import.meta.glob('./pages/**\/*.tsx')`
   * from `inertia/admin/app.tsx`.
   */
  pages?: Record<string, () => Promise<unknown>>

  /**
   * The app's custom components:
   * `import.meta.glob('./components/**\/*.tsx', { eager: true })`.
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

  return createInertiaApp({
    // The app's name (`brand.name` in config/admin.ts), from the root view
    title: (title) => {
      const name =
        document.querySelector<HTMLMetaElement>('meta[name="azu-app-name"]')?.content || 'Admin'
      return title ? `${title} · ${name}` : name
    },
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
          {/* React Aria links (table rows with an href) navigate through Inertia */}
          <RouterProvider navigate={(href) => router.visit(href)}>
            <App {...props} />
            <ToastRegion />
          </RouterProvider>
        </RegistryProvider>
      )
    },
  })
}
