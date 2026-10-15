import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import string from '@adonisjs/core/helpers/string'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { stubsRoot } from '../stubs/main.ts'

/**
 * `node ace make:admin-action <name>` (spec §7): writes a reusable row
 * action, or a bulk one with `--bulk`, to `app/admin/actions`. It has
 * an ability, a confirmation and a handler that uses the action's
 * transaction (FR-12).
 */
export default class MakeAdminAction extends BaseCommand {
  static commandName = 'make:admin-action'
  static description = 'Create a reusable admin action in app/admin/actions'
  static options: CommandOptions = {}

  @args.string({ description: 'The action, e.g. Archive or MarkAsPaid' })
  declare name: string

  @flags.boolean({ description: 'Make a bulk action, for the selected rows' })
  declare bulk: boolean

  @flags.boolean({ description: 'Overwrite the file if it exists', alias: 'f' })
  declare force: boolean

  async run() {
    const entity = this.app.generators.createEntity(this.name)
    const name = string.camelCase(entity.name)
    if (!/^[a-z][a-zA-Z0-9]*$/.test(name)) {
      this.logger.error(`"${this.name}" can't name an action: use letters and digits, like Archive`)
      this.exitCode = 1
      return
    }
    if (name === 'delete') {
      this.logger.error('Azu has a built-in Delete action. Name yours differently.')
      this.exitCode = 1
      return
    }

    const kind = this.bulk ? 'bulk' : 'row'
    const label = string.sentenceCase(name)
    const fileName = `${string.snakeCase(name)}.ts`
    const codemods = await this.createCodemods()
    codemods.overwriteExisting = this.force === true
    const output = await codemods.makeUsingStub(stubsRoot, 'make/admin_action.stub', {
      path: this.app.makePath('app/admin/actions', entity.path, fileName),
      kind,
      name,
      label,
      ability: name,
      // A bulk dialog adds the count: "Archive? (3 orders)"
      confirm: `${label}?`,
    })
    if (output.status !== 'skipped') {
      const importPath = ['#admin/actions', entity.path, fileName.replace(/\.ts$/, '')]
        .filter((part) => part && part !== './')
        .join('/')
      this.logger.info(
        `Add a ${name}(user, record) method to the policy of each resource that uses it, then import ${name} from '${importPath}' into its actions`
      )
    }
  }
}
