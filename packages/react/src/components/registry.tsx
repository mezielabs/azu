import { createContext, useContext, type ComponentType, type ReactNode } from 'react'
import { componentName } from '@mezielabs/azu/shared'

export type ComponentModules = Record<string, { default: ComponentType<any> }>

const RegistryContext = createContext<Record<string, ComponentType<any>>>({})

/**
 * Registers the app's components by file name (`componentName`, shared
 * with `admin:doctor`): `./components/sku_input.tsx` → `SkuInput`.
 */
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
