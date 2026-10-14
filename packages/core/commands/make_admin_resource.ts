import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import { generators } from '@adonisjs/core/app'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import type { LucidModel } from '@adonisjs/lucid/types/model'
import type { Database } from '@adonisjs/lucid/database'
import { planModel } from '../src/generator/model_info.ts'
import {
  renderPolicy,
  renderResource,
  renderValidator,
  type Names,
} from '../src/generator/render.ts'
import type { AzuConfig } from '../src/types.ts'

/**
 * `node ace make:admin-resource <Model>` (FR-04, spec §7): writes an admin
 * resource for a Lucid model, read from the model and its database
 * table, plus create and update validators unless `--no-validator`.
 */
export default class MakeAdminResource extends BaseCommand {
  static commandName = 'make:admin-resource'
  static description =
    'Generate an admin resource for a Lucid model, with create and update validators'
  static options: CommandOptions = { startApp: true }

  @args.string({ description: 'The model, e.g. Product or OrderItem' })
  declare model: string

  @flags.boolean({
    description: 'Write create and update validators in app/validators',
    default: true,
    showNegatedVariantInHelp: true,
  })
  declare validator: boolean

  @flags.boolean({
    description: 'Create a policy that lets admin users list, view, create and update',
  })
  declare policy: boolean

  @flags.boolean({
    description: 'List and detail only: no validators, and a policy without create or update',
  })
  declare readonly: boolean

  #display(path: string) {
    return relative(this.app.appRoot.pathname, path)
  }

  /**
   * Formats with the app's own Prettier and config, when it has them
   * (AdonisJS apps do), so the files match the rest of the codebase.
   */
  async #format(path: string, contents: string) {
    try {
      const require = createRequire(this.app.makePath('package.json'))
      const module = await import(pathToFileURL(require.resolve('prettier')).href)
      const prettier = (module.default ?? module) as {
        resolveConfig(file: string): Promise<object | null>
        format(source: string, options: object): Promise<string>
      }
      const options = (await prettier.resolveConfig(path)) ?? {}
      return await prettier.format(contents, { ...options, filepath: path })
    } catch {
      return contents
    }
  }

  async #write(path: string, contents: string) {
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, await this.#format(path, contents))
    this.logger.action(`create ${this.#display(path)}`).succeeded()
  }

  async run() {
    const name = generators.modelName(this.model)
    const fileName = generators.modelFileName(name)
    const modelPath = this.app.modelsPath(fileName)
    if (!existsSync(modelPath)) {
      this.logger.error(`Can't find the ${name} model at ${this.#display(modelPath)}`)
      this.exitCode = 1
      return
    }

    const config = this.app.config.get<AzuConfig>('admin', {} as AzuConfig)
    const autoload = config.resources?.autoload
    const resourcesDir = this.app.makePath(
      autoload === false || !autoload ? 'app/admin/resources' : autoload
    )
    const base = fileName.replace(/\.ts$/, '')
    const resourcePath = `${resourcesDir}/${base}_resource.ts`
    if (existsSync(resourcePath)) {
      this.logger.error(`${this.#display(resourcePath)} already exists; Azu doesn't overwrite it`)
      this.exitCode = 1
      return
    }

    const { default: model } = (await import(pathToFileURL(modelPath).href)) as {
      default: LucidModel
    }
    const db = (await this.app.container.make('lucid.db')) as Database
    const plan = await planModel(model, db.connection(), {
      modelFile: (related) => this.app.modelsPath(generators.modelFileName(related.name)),
      schemaFile: this.app.makePath('database/schema.ts'),
    })

    const flagsUsed = [
      this.policy && '--policy',
      this.readonly && '--readonly',
      !this.validator && '--no-validator',
    ]
      .filter(Boolean)
      .join(' ')

    // Validators: <model>.ts, or <model>_admin.ts when the app's own file has that name
    const writeValidators = this.validator && !this.readonly
    const policyFile = generators.policyFileName(name)
    const policyPath = this.app.policiesPath(policyFile)
    const validatorBase = generators.validatorFileName(name).replace(/\.ts$/, '')
    const validatorFile = existsSync(this.app.validatorsPath(`${validatorBase}.ts`))
      ? `${validatorBase}_admin`
      : validatorBase

    const names: Names = {
      model: name,
      modelImport: `#models/${base}`,
      policy: generators.policyName(name),
      policyImport: `#policies/${policyFile.replace(/\.ts$/, '')}`,
      createValidator: generators.validatorActionName(name, 'create'),
      updateValidator: generators.validatorActionName(name, 'update'),
      validatorImport: `#validators/${validatorFile}`,
      command: `node ace make:admin-resource ${name}${flagsUsed ? ` ${flagsUsed}` : ''}`,
    }

    if (!existsSync(policyPath)) {
      if (!this.policy) {
        this.logger.error(
          `${name} has no policy at ${this.#display(policyPath)}. Pass --policy to create one, or write your own.`
        )
        this.exitCode = 1
        return
      }
      await this.#write(policyPath, renderPolicy(plan, names, { readonly: this.readonly }))
    } else if (this.policy) {
      this.logger.warning(`${this.#display(policyPath)} already exists; using it as it is`)
    }

    if (writeValidators) {
      if (validatorFile !== validatorBase) {
        this.logger.info(
          `app/validators/${validatorBase}.ts is your own, so the admin validators go in app/validators/${validatorFile}.ts`
        )
      }
      await this.#write(
        this.app.validatorsPath(`${validatorFile}.ts`),
        renderValidator(plan, names)
      )
    }
    await this.#write(resourcePath, renderResource(plan, names, { validators: writeValidators }))

    for (const note of plan.skipped) this.logger.warning(`Skipped ${note}`)
    if (plan.uncovered.length > 0 && !this.readonly) {
      this.logger.warning(
        `${plan.uncovered.join(', ')} ${plan.uncovered.length === 1 ? 'is required but not an admin field' : 'are required but not admin fields'}, so ${name} records can't be created from the admin panel`
      )
    }
    if (autoload === false) {
      this.logger.info(`Register it in start/admin.ts: azu.register(${name}Resource)`)
    }
  }
}
