import { readFile, rm, writeFile } from 'node:fs/promises'
import { test } from '@japa/runner'
import ace from '@adonisjs/core/services/ace'
import app from '@adonisjs/core/services/app'
import ts from 'typescript'

/**
 * Type errors in one file of the app's front end, checked against the
 * whole `inertia/tsconfig.json` program, as `pnpm typecheck` checks it
 */
function typeErrors(path: string): string[] {
  const configPath = app.makePath('inertia/tsconfig.json')
  const { config } = ts.readConfigFile(configPath, ts.sys.readFile)
  const parsed = ts.parseJsonConfigFileContent(config, ts.sys, app.makePath('inertia'))
  const program = ts.createProgram({
    rootNames: parsed.fileNames,
    options: { ...parsed.options, noEmit: true },
  })
  const source = program.getSourceFile(path)
  if (!source) return [`${path} isn't part of inertia/tsconfig.json`]
  return [
    ...program.getSyntacticDiagnostics(source),
    ...program.getSemanticDiagnostics(source),
  ].map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
}

async function run(name: string, args: string[] = []) {
  await ace.boot()
  const Command = await ace.find(name)
  const command = await ace.create(Command!, args)
  await command.exec()
  return command
}

/**
 * Customising (FR-15): azu:doctor on the demo, and azu:publish. The docs'
 * Customising examples are the demo's own files (DemoCode in apps/docs),
 * so they can't drift from the code these tests run.
 */
test.group('Customising: doctor and publish (FR-15)', (group) => {
  group.setup(() => ace.ui.switchMode('raw'))
  group.teardown(() => ace.ui.switchMode('normal'))

  test('azu:doctor finds nothing wrong with the demo', async ({ assert }) => {
    const command = await run('azu:doctor')

    command.assertSucceeded()
    const logs = command.logger.getLogs().map((log) => log.message)
    assert.isTrue(
      logs.some((message) =>
        /Checked \d+ resources and 1 published page: 0 errors, 0 warnings/.test(message)
      ),
      logs.join('\n')
    )
  })

  test('azu:publish resource/index copies the page; doctor reports when it drifts', async ({
    assert,
    cleanup,
  }) => {
    const copy = app.makePath('inertia/admin/pages/resource/index.tsx')
    cleanup(() =>
      rm(app.makePath('inertia/admin/pages/resource'), { recursive: true, force: true })
    )

    const published = await run('azu:publish', ['resource/index'])
    published.assertSucceeded()
    const source = await readFile(
      app.makePath('node_modules/@mezielabs/azu-react/src/pages/resource/index.tsx'),
      'utf8'
    )
    const content = await readFile(copy, 'utf8')
    assert.match(
      content,
      /^\/\/ Published from @mezielabs\/azu-react \S+ by `node ace azu:publish resource\/index`\./
    )
    assert.isTrue(content.endsWith(source))
    // The copy compiles in the app unchanged: no relative imports into the package
    assert.deepEqual(typeErrors(copy), [])

    // The older spelling names the same page
    const again = await run('azu:publish', ['Resource/Index', '--force'])
    again.assertSucceeded()
    assert.equal(await readFile(copy, 'utf8'), content)

    // As if a newer Azu changed the original after this copy was published
    await writeFile(copy, content.replace(/sha256:[0-9a-f]{64}/, `sha256:${'0'.repeat(64)}`))
    const doctor = await run('azu:doctor')
    doctor.assertSucceeded()
    doctor.assertLogMatches(/inertia\/admin\/pages\/resource\/index\.tsx drifted/)
  }).timeout(60_000)
})
