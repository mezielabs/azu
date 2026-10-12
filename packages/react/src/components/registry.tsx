import { createContext, useContext, type ComponentType, type ReactNode } from 'react'

/**
 * Props every custom field component receives.
 */
export type FieldProps<Value = unknown> = {
  value: Value | null
  onChange: (value: Value | null) => void
  errors: string[]
  field: { name: string; label: string }
  record?: Record<string, unknown>
}

export type ComponentModules = Record<string, { default: ComponentType<any> }>

const RegistryContext = createContext<Record<string, ComponentType<any>>>({})

/**
 * `./components/sku_input.tsx` → `SkuInput`
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
  const map = Object.fromEntries(
    Object.entries(props.modules).map(([path, mod]) => [componentName(path), mod.default])
  )
  return <RegistryContext.Provider value={map}>{props.children}</RegistryContext.Provider>
}

/**
 * Looks up an app component registered from `inertia/admin/components`.
 */
export function useComponent(name: string | undefined): ComponentType<any> | undefined {
  const map = useContext(RegistryContext)
  return name ? map[name] : undefined
}
