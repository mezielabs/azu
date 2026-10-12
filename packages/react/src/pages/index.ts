import type { ComponentType } from 'react'

export type PageModule = { default: ComponentType<any> }

/**
 * Package pages, keyed by the name the server renders minus the `azu/`
 * prefix. Plain dynamic imports, so each page is its own chunk in the
 * app's build and Vite needs no `import.meta.glob` inside node_modules.
 */
export const packagePages: Record<string, () => Promise<PageModule>> = {
  'dashboard': () => import('./dashboard.tsx'),
  'resource/index': () => import('./resource/index.tsx'),
}
