import { createContext, useContext, type ComponentType, type ReactNode } from 'react'

export type ComponentModules = Record<string, { default: ComponentType<any> }>

const RegistryContext = createContext<Record<string, ComponentType<any>>>({})

/**
 * Maps a component file path to its registered name:
 * `./components/sku_input.tsx` → `SkuInput`.
 */
export function componentName(path: string) {
  const file = path
    .split('/')
    .pop()!
    .replace(/\.[jt]sx?$/, '')
  return file
    .split(/[_-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

export function RegistryProvider(props: { modules: ComponentModules; children: ReactNode }) {
  const components = Object.fromEntries(
    Object.entries(props.modules).map(([path, mod]) => [componentName(path), mod.default])
  )
  return <RegistryContext.Provider value={components}>{props.children}</RegistryContext.Provider>
}

/**
 * Looks up an app component registered from `inertia/admin/components`.
 */
export function useComponent(name: string | undefined): ComponentType<any> | undefined {
  const components = useContext(RegistryContext)
  return name ? components[name] : undefined
}
