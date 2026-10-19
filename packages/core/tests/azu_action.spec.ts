import { test } from '@japa/runner'
import { IgnitorFactory } from '@adonisjs/core/factories'
import type { FileSystem } from '@japa/file-system'
import AzuAction from '../commands/azu_action.ts'

async function createAce(fs: FileSystem) {
  await fs.createJson('tsconfig.json', {})
  await fs.createJson('package.json', { name: 'app', type: 'module' })
  await fs.create('adonisrc.ts', `export default defineConfig({})`)

  const ignitor = new IgnitorFactory()
    .withCoreProviders()
    .withCoreConfig()
    .create(fs.baseUrl, { importer: (filePath) => import(filePath) })
  const app = ignitor.createApp('console')
  await app.init()
  await app.boot()

  const ace = await app.container.make('ace')
  ace.ui.switchMode('raw')
  return ace
}

test.group('azu:action', (group) => {
  group.each.timeout(30_000)

  test('writes a row action with an ability, a confirmation and a trx handler', async ({
    assert,
    fs,
  }) => {
    const ace = await createAce(fs)
    const command = await ace.create(AzuAction, ['MarkAsPaid'])
    await command.exec()
    command.assertSucceeded()

    assert.equal(
      await fs.contents('app/admin/actions/mark_as_paid.ts'),
      [
        `import { action } from '@mezielabs/azu'`,
        ``,
        `/**`,
        ` * Mark as paid: a row action. Add it to a resource's \`actions\`;`,
        ` * tsc checks that the resource's policy has a \`markAsPaid\` method,`,
        ` * which Azu calls with the user and each record.`,
        ` */`,
        `export default action`,
        `  .row('markAsPaid')`,
        `  .confirm('Mark as paid?')`,
        `  .ability('markAsPaid')`,
        `  .handle(async (record, { trx }) => {`,
        `    // Change the record here. The handler runs in a transaction: run`,
        `    // every query through \`trx\` (\`Model.query({ client: trx })\`), so a`,
        `    // thrown error rolls back everything the action did.`,
        `    await record.useTransaction(trx).save()`,
        `    return { message: 'Mark as paid: done' }`,
        // AdonisJS trims stub output; the app's formatter adds the newline
        `  })`,
      ].join('\n')
    )
    command.assertLogMatches(/markAsPaid\(user, record\).*#admin\/actions\/mark_as_paid/)
  })

  test('--bulk writes a bulk action over the selected records', async ({ assert, fs }) => {
    const ace = await createAce(fs)
    const command = await ace.create(AzuAction, ['orders/archive', '--bulk'])
    await command.exec()
    command.assertSucceeded()

    const contents = await fs.contents('app/admin/actions/orders/archive.ts')
    assert.include(contents, `  .bulk('archive')`)
    assert.include(contents, `  .confirm('Archive?')`)
    assert.include(contents, `  .handle(async (records, { trx }) => {`)
    assert.include(contents, '      await record.useTransaction(trx).save()')
    assert.include(contents, 'return { message: `Archive: done for ${records.length} records` }')
    command.assertLogMatches(/#admin\/actions\/orders\/archive'/)
  })

  test("doesn't overwrite an action without --force", async ({ assert, fs }) => {
    const ace = await createAce(fs)
    await fs.create('app/admin/actions/archive.ts', '// mine')

    const command = await ace.create(AzuAction, ['Archive'])
    await command.exec()
    assert.equal(await fs.contents('app/admin/actions/archive.ts'), '// mine')

    const forced = await ace.create(AzuAction, ['Archive', '--force'])
    await forced.exec()
    await assert.fileContains('app/admin/actions/archive.ts', `.row('archive')`)
  })

  test('refuses delete, the built-in action, and names that are not identifiers', async ({
    assert,
    fs,
  }) => {
    const ace = await createAce(fs)
    for (const name of ['Delete', '2fa']) {
      const command = await ace.create(AzuAction, [name])
      await command.exec()
      command.assertFailed()
    }
    assert.isFalse(await fs.exists('app/admin/actions/delete.ts'))
  })
})
