import { basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fsReadAll } from '@adonisjs/core/helpers'
import { RuntimeException } from '@adonisjs/core/exceptions'
import string from '@adonisjs/core/helpers/string'
import { Screen } from './define_screen.ts'

/**
 * A screen's name from its file: `sales_report.ts` → `sales-report`.
 */
export function screenName(file: string): string {
  return string.dashCase(basename(file).replace(/\.(ts|js|mts|mjs)$/, ''))
}

/**
 * Imports every screen file in `directory` (FR-20). Each must export a
 * screen as its default. A missing directory means no screens.
 */
export async function loadScreens(
  directory: string
): Promise<{ name: string; screen: Screen<any> }[]> {
  const files = await fsReadAll(directory, {
    pathType: 'url',
    ignoreMissingRoot: true,
    filter: (file) => /\.(ts|js|mts|mjs)$/.test(file) && !/\.d\.m?ts$/.test(file),
    sort: (current, next) => current.localeCompare(next),
  })

  const screens: { name: string; screen: Screen<any> }[] = []
  for (const file of files) {
    const module = await import(file)
    if (!Screen.isScreen(module.default)) {
      throw new RuntimeException(
        `"${file}" must export a screen as its default: export default defineScreen({ ... })`
      )
    }
    screens.push({ name: screenName(fileURLToPath(file)), screen: module.default })
  }
  return screens
}
