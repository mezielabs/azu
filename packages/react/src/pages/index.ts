import type { ComponentType } from 'react'

export type PageModule = { default: ComponentType<any> }

/**
 * Package pages, keyed by the server's page name minus `azu/`. Plain
 * dynamic imports, so each page is its own chunk in the app's build and
 * Vite needs no `import.meta.glob` inside node_modules.
 */
export const packagePages: Record<string, () => Promise<PageModule>> = {
  'dashboard': () => import('./dashboard.tsx'),
  // SPIKE (Phase 1 UI check): remove with src/spike/
  'spike/ui_check': () => import('../spike/ui_check/page.tsx'),
}
