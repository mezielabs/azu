import { readFile, rm, writeFile } from 'node:fs/promises'
import { test } from '@japa/runner'
import ace from '@adonisjs/core/services/ace'
import app from '@adonisjs/core/services/app'
import ts from 'typescript'

const README = new URL('../../../../../README.md', import.meta.url)

/**
 * The README's "Customising" section, as code blocks: each one's
 * language and source.
 */
async function customisingExamples() {
  const readme = await readFile(README, 'utf8')
  const section = readme.slice(readme.indexOf('## Customising'), readme.indexOf('## Theming'))
  return [...section.matchAll(/```(\w+)\n([\s\S]*?)```/g)].map((match) => ({
    lang: match[1],
    source: match[2],
  }))
}

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

test.group('README "Customising" examples (FR-15)', (group) => {
  group.setup(() => ace.ui.switchMode('raw'))
  group.teardown(() => ace.ui.switchMode('normal'))

  test('every component example is a file in the demo, as written', async ({ assert }) => {
    const examples = await customisingExamples()
    const components = examples.filter((example) =>
      example.source.startsWith('// inertia/admin/components/')
    )
    assert.isAbove(components.length, 2)

    for (const example of components) {
      const path = example.source.split('\n')[0].replace('// ', '')
      assert.equal(await readFile(app.makePath(path), 'utf8'), example.source, path)
    }
  })

  test("every resource example is in the demo's resource it names", async ({ assert }) => {
    const all = await customisingExamples()
    const examples = all.filter((example) => example.lang === 'ts')
    assert.isAbove(examples.length, 1)

    for (const example of examples) {
      // A first-line path comment names the file; the product resource otherwise
      const named = /^\/\/ (app\/admin\/resources\/\S+\.ts)\n/.exec(example.source)?.[1]
      const path = named ?? 'app/admin/resources/product_resource.ts'
      const resource = await readFile(app.makePath(path), 'utf8')
      const lines = example.source
        .split('\n')
        .map((line) => line.trim().replace(/,$/, ''))
        .filter(
          (line) =>
            line && !line.startsWith('//') && !/^(\}\)|export default defineResource)/.test(line)
        )
      assert.isAbove(lines.length, 0, path)
      for (const line of lines) assert.include(resource, line, path)
    }
  })

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
