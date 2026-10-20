/**
 * Type tests for screen forms (FR-23), run by `pnpm typecheck`. Every
 * `@ts-expect-error` must produce an error, so each mistake is proven
 * to fail tsc, and the valid screens to compile.
 */
import vine from '@vinejs/vine'
import { defineScreen, field } from '@mezielabs/azu'
import { DateTime } from 'luxon'
import { manageSettings } from '#abilities/main'

const validator = vine.create({ storeName: vine.string(), vatRate: vine.string() })

const load = () => ({
  storeName: 'Azu Store' as string | null,
  vatRate: '7.50',
  orders: 3,
  maintenanceMode: false,
  lastChangedAt: DateTime.now() as DateTime | null,
})

export const valid = defineScreen({
  label: 'Settings',
  ability: manageSettings,
  form: {
    fields: [
      field.text('storeName'),
      field.decimal('vatRate'),
      field.number('orders'),
      field.boolean('maintenanceMode'),
      field.datetime('lastChangedAt').readOnly(),
    ],
    validator,
    load,
    // `save` gets the validator's output, typed
    save: (input) => {
      const name: string = input.storeName
      void name
    },
  },
})

export const misspelled = defineScreen({
  label: 'Settings',
  ability: manageSettings,
  form: {
    fields: [
      // @ts-expect-error a field name load doesn't return
      field.text('storName'),
    ],
    validator,
    load,
    save: () => {},
  },
})

export const wrongKind = defineScreen({
  label: 'Settings',
  ability: manageSettings,
  form: {
    fields: [
      // @ts-expect-error a boolean field on a string value
      field.boolean('storeName'),
    ],
    validator,
    load,
    save: () => {},
  },
})

export const unsupported = defineScreen({
  label: 'Settings',
  ability: manageSettings,
  form: {
    fields: [
      // @ts-expect-error file fields wait (FR-23)
      field.file('storeName'),
      // @ts-expect-error so do relations
      field.belongsTo('storeName'),
    ],
    validator,
    load,
    save: () => {},
  },
})

export const fieldAbility = defineScreen({
  label: 'Settings',
  ability: manageSettings,
  form: {
    fields: [
      // @ts-expect-error the screen's ability covers the form
      field.text('storeName').ability('update'),
    ],
    validator,
    load,
    save: () => {},
  },
})

// @ts-expect-error a component and a form on one screen
export const both = defineScreen({
  label: 'Settings',
  ability: manageSettings,
  component: 'Settings',
  form: { fields: [field.text('storeName')], validator, load, save: () => {} },
})

export const withData = defineScreen({
  label: 'Settings',
  ability: manageSettings,
  // @ts-expect-error data and a form don't mix
  data: () => ({ orders: 3 }),
  form: { fields: [field.text('storeName')], validator, load, save: () => {} },
})

export const badSave = defineScreen({
  label: 'Settings',
  ability: manageSettings,
  form: {
    fields: [field.text('storeName')],
    validator,
    load,
    save: (input) => {
      // @ts-expect-error not in the validator's output
      void input.isAdmin
    },
  },
})
