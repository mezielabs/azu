import { readFile, rm, writeFile } from 'node:fs/promises'
import { test } from '@japa/runner'
import ace from '@adonisjs/core/services/ace'
import app from '@adonisjs/core/services/app'

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

  test("every resource example is in the demo's product resource", async ({ assert }) => {
    const resource = await readFile(app.makePath('app/admin/resources/product_resource.ts'), 'utf8')
    const examples = await customisingExamples()
    const lines = examples
      .filter((example) => example.lang === 'ts')
      .flatMap((example) => example.source.split('\n'))
      .map((line) => line.trim().replace(/,$/, ''))
      .filter(
        (line) =>
          line && !line.startsWith('//') && !/^(\}\)|export default defineResource)/.test(line)
      )
    assert.isAbove(lines.length, 2)

    for (const line of lines) assert.include(resource, line)
  })

  test('admin:doctor finds nothing wrong with the demo', async ({ assert }) => {
    const command = await run('admin:doctor')

    command.assertSucceeded()
    const logs = command.logger.getLogs().map((log) => log.message)
    assert.isTrue(
      logs.some((message) =>
        /Checked \d+ resources and 1 published page: 0 errors, 0 warnings/.test(message)
      ),
      logs.join('\n')
    )
  })

  test('admin:publish resource/index copies the page; doctor reports when it drifts', async ({
    assert,
    cleanup,
  }) => {
    const copy = app.makePath('inertia/admin/pages/resource/index.tsx')
    cleanup(() =>
      rm(app.makePath('inertia/admin/pages/resource'), { recursive: true, force: true })
    )

    const published = await run('admin:publish', ['resource/index'])
    published.assertSucceeded()
    const source = await readFile(
      app.makePath('node_modules/@mezielabs/azu-react/src/pages/resource/index.tsx'),
      'utf8'
    )
    const content = await readFile(copy, 'utf8')
    assert.match(
      content,
      /^\/\/ Published from @mezielabs\/azu-react \S+ by `node ace admin:publish resource\/index`\./
    )
    assert.isTrue(content.endsWith(source))

    // The older spelling names the same page
    const again = await run('admin:publish', ['Resource/Index', '--force'])
    again.assertSucceeded()
    assert.equal(await readFile(copy, 'utf8'), content)

    // As if a newer Azu changed the original after this copy was published
    await writeFile(copy, content.replace(/sha256:[0-9a-f]{64}/, `sha256:${'0'.repeat(64)}`))
    const doctor = await run('admin:doctor')
    doctor.assertSucceeded()
    doctor.assertLogMatches(/inertia\/admin\/pages\/resource\/index\.tsx drifted/)
  })
})
