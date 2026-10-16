import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import {
  PAGE_NAMES,
  findReactPackage,
  pageName,
  publishedPath,
  publishedSource,
} from '../src/publish/pages.ts'

/**
 * `node ace admin:publish [page]` (FR-15): copies one of Azu's pages
 * into `inertia/admin/pages`, where the admin entry picks it up instead
 * of the package's. The copy starts with a stamp naming the
 * `@mezielabs/azu-react` version and a hash of the original, which
 * `admin:doctor` compares after an upgrade. Without a page, it lists them.
 */
export default class AdminPublish extends BaseCommand {
  static commandName = 'admin:publish'
  static description = "Copy one of Azu's pages into inertia/admin/pages to edit it"
  static options: CommandOptions = {}

  @args.string({
    description: 'The page, e.g. resource/index (Resource/Index works too)',
    required: false,
  })
  declare page?: string

  @flags.boolean({ description: 'Overwrite a page you already published', alias: 'f' })
  declare force: boolean

  async run() {
    if (!this.page) {
      this.logger.info('Pages you can publish:')
      for (const page of PAGE_NAMES) {
        const published = existsSync(this.app.makePath(publishedPath(page)))
        this.logger.log(`  ${page}${published ? ' (published)' : ''}`)
      }
      this.logger.log('Publish one with: node ace admin:publish resource/index')
      return
    }

    const page = pageName(this.page)
    if (!page) {
      this.logger.error(`Azu has no page named "${this.page}". Pages: ${PAGE_NAMES.join(', ')}`)
      this.exitCode = 1
      return
    }

    const pkg = await findReactPackage(fileURLToPath(this.app.appRoot))
    const source = await pkg?.pageSource(page)
    if (!pkg || !source) {
      this.logger.error(
        "Can't find @mezielabs/azu-react's pages. Install it with your package manager first."
      )
      this.exitCode = 1
      return
    }

    const target = publishedPath(page)
    const file = this.app.makePath(target)
    if (existsSync(file) && !this.force) {
      this.logger.error(
        `${target} already exists. Pass --force to replace it with Azu's page; your edits to it are lost.`
      )
      this.exitCode = 1
      return
    }

    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, publishedSource(page, pkg.version, source))
    this.logger.success(`Published ${page} to ${target}`)
    this.logger.info(
      'Azu renders your copy from now on. After upgrading, run node ace admin:doctor to see whether the original changed.'
    )
  }
}
