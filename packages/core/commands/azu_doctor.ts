import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { configProvider } from '@adonisjs/core'
import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { defineConfig } from '../src/define_config.ts'
import {
  checkComponents,
  checkConfig,
  checkPolicies,
  checkPublished,
  checkScreenValidators,
  checkValidators,
  type Finding,
} from '../src/doctor/checks.ts'
import { FILE_KINDS } from '../src/files/uploads.ts'
import { PAGE_NAMES, findReactPackage, type PageName } from '../src/publish/pages.ts'
import { componentName } from '../src/shared/components.ts'
import type { AzuConfig } from '../src/types.ts'

/**
 * Every file under `dir` whose name matches, relative to it. None when
 * `dir` doesn't exist.
 */
async function filesIn(dir: string, pattern: RegExp): Promise<string[]> {
  if (!existsSync(dir)) return []
  const entries = await readdir(dir, { recursive: true, withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && pattern.test(entry.name))
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)).split('\\').join('/'))
    .sort()
}

/**
 * `node ace azu:doctor` (FR-15): checks the app's Azu setup and
 * reports what won't work as written. Config that points at missing
 * guards, disks or files; policy methods resources rely on; form fields
 * their validators don't declare; component names no file registers;
 * and published pages whose original changed in a newer
 * `@mezielabs/azu-react`. Exits with 1 when it finds an error.
 */
export default class AzuDoctor extends BaseCommand {
  static commandName = 'azu:doctor'
  static description = 'Check config, policies, validators, components and published pages'
  static options: CommandOptions = { startApp: true }

  async run() {
    const config = this.app.config.get<AzuConfig>('azu', defineConfig())
    const azu = await this.app.container.make('azu')
    const resources = azu.resources.all()
    const root = fileURLToPath(this.app.appRoot)

    const uploadDisks = resources.flatMap((resource) =>
      resource
        .toSchema()
        .fields.filter((field) => FILE_KINDS.has(field.kind))
        .map((field) => field.disk ?? undefined)
    )
    // config/auth.ts and config/drive.ts export config providers
    const guards = await this.resolved<{ guards?: Record<string, unknown> }>('auth')
    const disks = await this.resolved<{ config?: { services?: Record<string, unknown> } }>('drive')
    const vite = join(root, 'vite.config.ts')
    const autoload = config.resources.autoload

    const componentsDir = this.app.makePath('inertia/admin/components')
    const registered = new Map<string, string[]>()
    for (const file of await filesIn(componentsDir, /\.[jt]sx?$/)) {
      const name = componentName(file)
      registered.set(name, [...(registered.get(name) ?? []), `inertia/admin/components/${file}`])
    }

    const pagesDir = this.app.makePath('inertia/admin/pages')
    const pageFiles = await filesIn(pagesDir, /\.tsx$/)
    const published = await Promise.all(
      pageFiles.map(async (file) => ({
        page: file.replace(/\.tsx$/, ''),
        content: await readFile(join(pagesDir, file), 'utf8'),
      }))
    )
    const pkg = published.length > 0 ? await findReactPackage(root) : null
    const sources = new Map<PageName, string | null>()
    if (pkg) {
      for (const page of PAGE_NAMES) sources.set(page, await pkg.pageSource(page))
    }

    const findings: Finding[] = [
      ...checkConfig({
        config,
        guards: guards ? Object.keys(guards.guards ?? {}) : null,
        disks: disks ? Object.keys(disks.config?.services ?? {}) : null,
        uploadDisks,
        entryExists: existsSync(this.app.makePath(config.entry)),
        viteConfig: existsSync(vite) ? await readFile(vite, 'utf8') : null,
        autoloadExists: autoload === false ? null : existsSync(this.app.makePath(autoload)),
        resourceCount: resources.length,
        screenNames: azu.screens.all().map((entry) => entry.name),
        resourceNames: resources.map((resource) => resource.name),
      }),
      ...checkPolicies(resources),
      ...checkValidators(resources),
      ...checkScreenValidators(azu.screens.all()),
      ...checkComponents(resources, registered, azu.screens.all()),
      ...checkPublished(published, pkg && { version: pkg.version, sources }),
    ]

    this.report(findings, { resources: resources.length, published: published.length })
    if (findings.some((finding) => finding.level === 'error')) this.exitCode = 1
  }

  /**
   * A config file that exports a config provider (`defineConfig` from
   * auth or Drive), resolved. `null` when the app has no such file.
   */
  protected async resolved<T>(name: string): Promise<T | null> {
    const exported = this.app.config.get<unknown>(name)
    if (exported === undefined) return null
    return ((await configProvider.resolve<T>(this.app, exported)) ?? null) as T | null
  }

  protected report(findings: Finding[], counts: { resources: number; published: number }) {
    const areas = ['config', 'policies', 'validators', 'components', 'published pages'] as const
    for (const area of areas) {
      const found = findings.filter((finding) => finding.area === area)
      if (found.length === 0) {
        this.logger.success(`${area}: ok`)
        continue
      }
      for (const finding of found) {
        const line = `${area}: ${finding.message}`
        if (finding.level === 'error') this.logger.error(line)
        else if (finding.level === 'warning') this.logger.warning(line)
        else this.logger.info(line)
      }
    }
    const errors = findings.filter((finding) => finding.level === 'error').length
    const warnings = findings.filter((finding) => finding.level === 'warning').length
    const summary =
      `Checked ${counts.resources} resource${counts.resources === 1 ? '' : 's'} and ` +
      `${counts.published} published page${counts.published === 1 ? '' : 's'}: ` +
      `${errors} error${errors === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'}`
    if (errors > 0) this.logger.error(summary)
    else this.logger.success(summary)
  }
}
