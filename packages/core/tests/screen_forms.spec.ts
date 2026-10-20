import { test } from '@japa/runner'
import type { HttpContext } from '@adonisjs/core/http'
import { Bouncer } from '@adonisjs/bouncer'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import { checkComponents, checkScreenValidators } from '../src/doctor/checks.ts'
import { field } from '../src/resources/fields.ts'
import { defineScreen, Screen } from '../src/screens/define_screen.ts'
import { saveScreenForm, screenFormData, screenFormFields } from '../src/screens/screen_form.ts'

const admins = Bouncer.ability(() => true)

const validator = vine.create({
  storeName: vine.string().trim().minLength(2).maxLength(80),
  vatRate: vine.string(),
  maintenanceMode: vine.boolean(),
  announcement: vine.string().nullable().optional(),
})

function settings(overrides: { save?: (input: unknown) => void; changedAt?: DateTime } = {}) {
  const saved: unknown[] = []
  const screen = defineScreen({
    label: 'Store settings',
    ability: admins,
    form: {
      fields: [
        field.text('storeName'),
        field.decimal('vatRate'),
        field.boolean('maintenanceMode'),
        field.richText('announcement'),
        field.datetime('lastChangedAt').readOnly(),
      ],
      validator,
      load: () => ({
        storeName: 'Azu Store',
        vatRate: '7.50',
        maintenanceMode: false,
        announcement: '<p>Hello</p>',
        lastChangedAt: overrides.changedAt ?? DateTime.utc(2026, 10, 1, 9, 0),
      }),
      save: (input) => {
        saved.push(input)
        overrides.save?.(input)
      },
    },
  })
  return { screen, saved }
}

function request(body: Record<string, unknown>) {
  return { request: { body: () => body } } as unknown as HttpContext
}

/** A form-shaped object that isn't valid, for the boot errors */
const loose = (options: Record<string, unknown>) =>
  defineScreen(options as unknown as Parameters<typeof defineScreen>[0])

test.group('Screen forms (FR-23)', () => {
  test('a screen takes a form instead of a component', ({ assert }) => {
    const { screen } = settings()
    assert.instanceOf(screen, Screen)
    assert.isDefined(screen.form)
    assert.deepEqual(screen.toSchema('store-settings'), {
      name: 'store-settings',
      label: 'Store settings',
      group: null,
      icon: null,
      component: null,
      form: true,
    })
  })

  test('exactly one of component or form, and no data beside a form', ({ assert }) => {
    const form = { fields: [field.text('title')], validator, load: () => ({}), save: () => {} }
    assert.throws(
      () => loose({ label: 'Settings', ability: admins }),
      /"Settings" screen needs exactly one of "component" \(your component\) or "form"/
    )
    assert.throws(
      () => loose({ label: 'Settings', ability: admins, component: 'Settings', form }),
      /exactly one of .*, not both/
    )
    assert.throws(
      () => loose({ label: 'Settings', ability: admins, form, data: () => ({}) }),
      /has a form and "data": a form's values come from its "load"/
    )
  })

  test('a form needs load, save, a validator and fields', ({ assert }) => {
    const form = { fields: [field.text('title')], validator, load: () => ({}), save: () => {} }
    assert.throws(
      () => loose({ label: 'S', ability: admins, form: { ...form, load: undefined } }),
      /form needs a "load" function/
    )
    assert.throws(
      () => loose({ label: 'S', ability: admins, form: { ...form, save: undefined } }),
      /form needs a "save" function/
    )
    assert.throws(
      () => loose({ label: 'S', ability: admins, form: { ...form, validator: {} } }),
      /form needs a VineJS validator/
    )
    assert.throws(
      () => loose({ label: 'S', ability: admins, form: { ...form, fields: [] } }),
      /form needs fields/
    )
  })

  test('file, image and relation fields, and field abilities, are boot errors naming the field', ({
    assert,
  }) => {
    const base = { validator, load: () => ({}), save: () => {} }
    for (const [made, kind] of [
      [field.file('manual'), 'file'],
      [field.image('logo'), 'image'],
      [field.belongsTo('owner'), 'belongsTo'],
      [field.manyToMany('tags'), 'manyToMany'],
      [field.hasMany('orders'), 'hasMany'],
    ] as const) {
      assert.throws(
        () => loose({ label: 'Settings', ability: admins, form: { ...base, fields: [made] } }),
        new RegExp(
          `"Settings" screen's "${made.name}" field is a ${kind} field; screen forms take text, textarea`
        )
      )
    }
    assert.throws(
      () =>
        loose({
          label: 'Settings',
          ability: admins,
          form: { ...base, fields: [field.text('title').ability('update')] },
        }),
      /"title" field has an ability: on a screen, the screen's ability covers the form/
    )
  })

  test("fields take the validator's hints; values come from load", async ({ assert }) => {
    const { screen } = settings()
    const fields = screenFormFields(screen.form!)
    const storeName = fields.find((item) => item.name === 'storeName')!
    assert.isTrue(storeName.required)
    assert.equal(storeName.minLength, 2)
    assert.equal(storeName.maxLength, 80)
    assert.isFalse(fields.find((item) => item.name === 'announcement')!.required)

    const data = await screenFormData(request({}), screen, fields)
    assert.equal(data.successMessage, 'Store settings saved')
    assert.deepEqual(data.values, {
      storeName: 'Azu Store',
      vatRate: '7.50',
      maintenanceMode: false,
      announcement: '<p>Hello</p>',
      lastChangedAt: '2026-10-01T09:00:00.000Z',
    })
  })

  test('save gets only the writable fields, through the validator', async ({ assert }) => {
    const { screen, saved } = settings()
    const fields = screenFormFields(screen.form!)
    const result = await saveScreenForm(
      request({
        storeName: '  Iya Basira  ',
        vatRate: '5.00',
        maintenanceMode: true,
        announcement: '<p>Sale</p><script>alert(1)</script>',
        // Undeclared, and read-only: never saved
        role: 'admin',
        isAdmin: true,
        lastChangedAt: '1999-01-01T00:00:00Z',
      }),
      screen,
      fields,
      { timezone: 'Africa/Lagos' }
    )
    assert.isUndefined(result.errors)
    assert.deepEqual(saved, [
      {
        storeName: 'Iya Basira',
        vatRate: '5.00',
        maintenanceMode: true,
        announcement: '<p>Sale</p>',
      },
    ])
  })

  test('invalid input returns errors and never calls save', async ({ assert }) => {
    const { screen, saved } = settings()
    const result = await saveScreenForm(
      request({ storeName: 'A', vatRate: '5', maintenanceMode: false }),
      screen,
      screenFormFields(screen.form!)
    )
    assert.properties(result.errors!, ['storeName'])
    assert.lengthOf(saved, 0)
  })

  test("a throw in save isn't swallowed", async ({ assert }) => {
    const { screen } = settings({
      save: () => {
        throw new Error('the database is down')
      },
    })
    await assert.rejects(
      () =>
        saveScreenForm(
          request({ storeName: 'Azu', vatRate: '5', maintenanceMode: false }),
          screen,
          screenFormFields(screen.form!)
        ),
      'the database is down'
    )
  })
})

test.group('Doctor checks for screen forms (FR-23)', () => {
  test("a form field the validator doesn't declare is an error; read-only ones aren't checked", ({
    assert,
  }) => {
    const screen = defineScreen({
      label: 'Settings',
      ability: admins,
      form: {
        fields: [
          field.text('storeName'),
          field.text('tagline'),
          field.datetime('lastChangedAt').readOnly(),
        ],
        validator: vine.create({ storeName: vine.string() }),
        load: () => ({
          storeName: 'Azu',
          tagline: 'Shop',
          lastChangedAt: null as DateTime | null,
        }),
        save: () => {},
      },
    })
    const screens = [{ name: 'settings', screen }]
    assert.deepEqual(checkScreenValidators(screens), [
      {
        level: 'error',
        area: 'validators',
        message:
          'the settings screen\'s validator has no "tagline", so what users enter in that field isn\'t saved',
      },
    ])
    // A form screen has no component to look for
    assert.deepEqual(checkComponents([], new Map(), screens), [])
  })

  test("a validator that isn't VineJS 4 is a note", ({ assert }) => {
    const screen = defineScreen({
      label: 'Settings',
      ability: admins,
      form: {
        fields: [field.text('storeName')],
        validator: { validate: async (data: unknown) => data as { storeName: string } },
        load: () => ({ storeName: 'Azu' }),
        save: () => {},
      },
    })
    assert.deepEqual(checkScreenValidators([{ name: 'settings', screen }]), [
      {
        level: 'note',
        area: 'validators',
        message:
          "the settings screen's validator isn't a VineJS 4 validator, so its fields can't be checked",
      },
    ])
  })
})
