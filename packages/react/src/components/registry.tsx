import { createContext, lazy, useContext, type ComponentType, type ReactNode } from 'react'
import { componentName } from '@mezielabs/azu/shared'

type ComponentModule = { default: ComponentType<any> }

/**
 * The app's components, from `inertia/admin/app.tsx`: a lazy
 * `import.meta.glob('./components/**\/*.tsx')`, whose values load a
 * module, or an eager one (`{ eager: true }`), whose values are modules.
 */
export type ComponentModules = Record<string, (() => Promise<unknown>) | ComponentModule>

type Entry = {
  load: () => Promise<ComponentModule>
  /** Set once loaded, so later renders don't suspend */
  component: ComponentType<any> | null
  lazy: ComponentType<any>
}

/**
 * The app's components by registered name (`componentName`, shared with
 * `admin:doctor`): `./components/sku_input.tsx` → `SkuInput`. A lazy
 * component loads the first time a page uses it; `preload` loads a
 * page's before it renders.
 */
export class ComponentRegistry {
  #entries = new Map<string, Entry>()

  constructor(modules: ComponentModules = {}) {
    for (const [path, source] of Object.entries(modules)) {
      const eager = typeof source === 'function' ? null : source.default
      let pending: Promise<ComponentModule> | null = null
      const entry: Entry = {
        component: eager,
        load: () =>
          eager
            ? Promise.resolve({ default: eager })
            : (pending ??= (source as () => Promise<ComponentModule>)().then((module) => {
                entry.component = module.default
                return module
              })),
        lazy: eager ?? lazy(() => entry.load()),
      }
      this.#entries.set(componentName(path), entry)
    }
  }

  /** The component registered under `name`; it may suspend on first use */
  get(name: string | undefined): ComponentType<any> | undefined {
    const entry = name ? this.#entries.get(name) : undefined
    return entry ? (entry.component ?? entry.lazy) : undefined
  }

  /** Loads the named components; names nothing registers are skipped */
  async preload(names: Iterable<string>): Promise<void> {
    await Promise.all(
      [...names].map((name) =>
        this.#entries
          .get(name)
          ?.load()
          .catch(() => undefined)
      )
    )
  }
}

const RegistryContext = createContext(new ComponentRegistry())

export function RegistryProvider(props: { registry: ComponentRegistry; children: ReactNode }) {
  return (
    <RegistryContext.Provider value={props.registry}>{props.children}</RegistryContext.Provider>
  )
}

/**
 * Looks up an app component registered from `inertia/admin/components`.
 * Render it inside a `Suspense` with a fallback the size of what it
 * replaces: a lazily registered component may not have loaded yet.
 */
export function useComponent(name: string | undefined): ComponentType<any> | undefined {
  return useContext(RegistryContext).get(name)
}
