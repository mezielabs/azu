/*
|--------------------------------------------------------------------------
| Configure hook
|--------------------------------------------------------------------------
|
| Runs on "node ace add @mezielabs/azu" (or "node ace configure"). Mounts
| the panel at /admin with no manual edits (FR-01).
|
*/

import { appendFile } from 'node:fs/promises'
import type Configure from '@adonisjs/core/commands/configure'
import { stubsRoot } from './stubs/main.ts'

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
  for (const stub of ['config/admin.stub', 'inertia/admin/app.stub']) {
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
  })
  await codemods.registerVitePlugin('azu()', [
    { isNamed: true, module: '@mezielabs/azu/vite', identifier: 'azu' },
  ])

  if (shouldInstallPackages) {
    await codemods.installPackages([FRONT_END_PACKAGE])
  } else {
    await codemods.listPackagesToInstall([FRONT_END_PACKAGE])
  }
}
