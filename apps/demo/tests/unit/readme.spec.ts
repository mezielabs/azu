import { readFile } from 'node:fs/promises'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'

const README = new URL('../../../../README.md', import.meta.url)

/**
 * The README's one resource example is the demo's category resource.
 * The docs show demo files directly (DemoCode in apps/docs), but the
 * README is plain Markdown on GitHub and npm, so it keeps a copy.
 */
test.group('README', () => {
  test('its resource example is the demo file it names, as written', async ({ assert }) => {
    const readme = await readFile(README, 'utf8')
    const examples = [
      ...readme.matchAll(/```ts\n\/\/ (app\/admin\/resources\/\S+\.ts)\n([\s\S]*?)```/g),
    ]
    assert.lengthOf(examples, 1)

    const [, path, source] = examples[0]
    assert.equal(source, await readFile(app.makePath(path), 'utf8'), path)
  })
})
