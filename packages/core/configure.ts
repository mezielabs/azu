/*
|--------------------------------------------------------------------------
| Configure hook
|--------------------------------------------------------------------------
|
| Runs on "node ace add @mezielabs/azu" (or "node ace configure"). Mounts
| the panel at /admin with no manual edits (FR-01).
|
*/

import { existsSync } from 'node:fs'
import { appendFile, readFile, writeFile } from 'node:fs/promises'
import type Configure from '@adonisjs/core/commands/configure'
import { stubsRoot } from './stubs/main.ts'

/**
 * Appended to app/abilities/main.ts. Denies everyone until the app
 * decides who gets in (FR-02).
 */
const ACCESS_ABILITY = `
/**
 * Who can open the admin panel. Azu denies everyone until this returns
 * true, for example: (user: User) => user.role === 'admin'
 */
export const accessAdmin = Bouncer.ability(() => {
  return false
})
`

/**
 * Adds the accessAdmin ability when Bouncer is set up and the ability
 * doesn't exist yet. Without Bouncer, the access gate fails closed, so
 * explain how to add it instead of installing it here (AdonisJS presets
 * don't install their dependencies either).
 */
async function addAccessAbility(command: Configure) {
  const abilitiesFile = command.app.makePath('app/abilities/main.ts')

  if (!existsSync(abilitiesFile)) {
    command.logger.warning(
      'Bouncer is not set up, so the admin panel denies everyone. Run "node ace add @adonisjs/bouncer", then "node ace configure @mezielabs/azu" again'
    )
    return
  }

  let contents = await readFile(abilitiesFile, 'utf8')
  if (/export const accessAdmin\b/.test(contents)) {
    command.logger.action('update app/abilities/main.ts').skipped('accessAdmin already exists')
    return
  }

  if (!/import \{[^}]*\bBouncer\b[^}]*\} from '@adonisjs\/bouncer'/.test(contents)) {
    contents = `import { Bouncer } from '@adonisjs/bouncer'\n${contents}`
  }
  await writeFile(abilitiesFile, `${contents.trimEnd()}\n${ACCESS_ABILITY}`)
  command.logger.action('update app/abilities/main.ts').succeeded()
}

/**
 * The front-end package installed alongside core.
 */
const FRONT_END_PACKAGE = { name: '@mezielabs/azu-react', isDevDependency: false }

export async function configure(command: Configure) {
  let shouldInstallPackages: boolean | undefined = command.parsedFlags.install

  /**
   * Prompt when neither `--install` nor `--no-install` is used
   */
  if (shouldInstallPackages === undefined) {
    shouldInstallPackages = await command.prompt.confirm(
      `Do you want to install "${FRONT_END_PACKAGE.name}"?`,
      { default: true }
    )
  }

  const codemods = await command.createCodemods()

  /**
   * Config file and the admin Vite entry. Existing files are kept.
   * Stub rendering trims the output, so add back the final newline that
   * the app's Prettier config expects.
   */
  for (const stub of ['config/admin.stub', 'start/admin.stub', 'inertia/admin/app.stub']) {
    const output = await codemods.makeUsingStub(stubsRoot, stub, {})
    if (output.status === 'created' || output.status === 'force_created') {
      await appendFile(output.destination, '\n')
    }
  }

  /**
   * Register the provider and the Vite plugin that adds the admin entry
   */
  await codemods.updateRcFile((rcFile) => {
    rcFile.addProvider('@mezielabs/azu/azu_provider')
    rcFile.addPreloadFile('#start/admin')
  })

  /**
   * So start/admin.ts can import resources as #admin/resources/...
   */
  await codemods.addImportAlias('#admin/*', './app/admin/*.js')
  await codemods.registerVitePlugin('azu()', [
    { isNamed: true, module: '@mezielabs/azu/vite', identifier: 'azu' },
  ])

  /**
   * The access gate's ability (FR-02)
   */
  await addAccessAbility(command)

  if (shouldInstallPackages) {
    await codemods.installPackages([FRONT_END_PACKAGE])
  } else {
    await codemods.listPackagesToInstall([FRONT_END_PACKAGE])
  }
}
