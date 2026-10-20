import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import string from '@adonisjs/core/helpers/string'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { stubsRoot } from '../stubs/main.ts'

/**
 * `node ace azu:screen <Name>` (FR-20, spec §7): writes a custom screen
 * to `app/admin/screens/<name>.ts` and its component to
 * `inertia/admin/components/<name>.tsx`, which compile and render as
 * they are. With `--form` (FR-23), a form screen and its validator in
 * `app/validators/<name>.ts` instead.
 */
export default class AzuScreen extends BaseCommand {
  static commandName = 'azu:screen'
  static description = 'Create a custom admin screen and its component, or a form screen'
  static options: CommandOptions = {}

  @args.string({ description: 'The screen, e.g. SalesReport or Overview' })
  declare name: string

  @flags.boolean({
    description: 'A form Azu renders, with a validator in app/validators, instead of a component',
  })
  declare form: boolean

  @flags.boolean({ description: 'Overwrite the files if they exist', alias: 'f' })
  declare force: boolean

  async run() {
    const pascal = string.pascalCase(this.name)
    if (!/^[A-Z][a-zA-Z0-9]*$/.test(pascal)) {
      this.logger.error(
        `"${this.name}" can't name a screen: use letters and digits, like SalesReport`
      )
      this.exitCode = 1
      return
    }
    const file = string.snakeCase(pascal)
    const name = string.dashCase(pascal)
    const label = string.sentenceCase(pascal)
    const codemods = await this.createCodemods()
    codemods.overwriteExisting = this.force === true

    const values = { name, file, label, component: pascal }
    if (this.form) {
      const validator = `${string.camelCase(pascal)}Validator`
      const screen = await codemods.makeUsingStub(stubsRoot, 'make/screen_form.stub', {
        ...values,
        validator,
        path: this.app.makePath('app/admin/screens', `${file}.ts`),
      })
      await codemods.makeUsingStub(stubsRoot, 'make/screen_validator.stub', {
        ...values,
        validator,
        path: this.app.validatorsPath(`${file}.ts`),
      })
      if (screen.status !== 'skipped') {
        this.logger.info(
          `Open it at /admin/screens/${name}. Its values live in memory until load and save use your storage; give it a narrower ability than accessAdmin for anything sensitive`
        )
      }
      return
    }
    const screen = await codemods.makeUsingStub(stubsRoot, 'make/screen.stub', {
      ...values,
      path: this.app.makePath('app/admin/screens', `${file}.ts`),
    })
    await codemods.makeUsingStub(stubsRoot, 'make/screen_component.stub', {
      ...values,
      path: this.app.makePath('inertia/admin/components', `${file}.tsx`),
    })
    if (screen.status !== 'skipped') {
      this.logger.info(
        `Open it at /admin/screens/${name}. It's in the navigation for users who pass its ability (accessAdmin); give it a narrower one for anything sensitive`
      )
    }
  }
}
