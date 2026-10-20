import { defineScreen, field } from '@mezielabs/azu'
import { DateTime } from 'luxon'
import { manageSettings } from '#abilities/main'
import Setting from '#models/setting'
import { storeSettingsValidator } from '#validators/store_settings'

/**
 * The store's settings (FR-23): a form Azu renders, for admins only
 * (manageSettings). `load` and `save` go through the app's own Setting
 * model; Azu never touches the settings table.
 */
export default defineScreen({
  label: 'Store settings',
  group: 'Settings',
  icon: 'settings',
  ability: manageSettings,
  form: {
    fields: [
      field.text('storeName'),
      field.text('supportEmail').help('Shown to customers on receipts and the contact page'),
      field.select('currency').options({
        NGN: 'Nigerian naira',
        GHS: 'Ghanaian cedi',
        KES: 'Kenyan shilling',
        ZAR: 'South African rand',
        USD: 'US dollar',
        GBP: 'British pound',
      }),
      field.decimal('vatRate').label('VAT rate (%)').min(0).max(100).step('0.01'),
      field.boolean('maintenanceMode').help('Customers see a notice instead of the shop'),
      field.richText('checkoutAnnouncement').help('Shown above the basket at checkout'),
      field.datetime('lastChangedAt').label('Last changed').readOnly(),
    ],
    validator: storeSettingsValidator,
    load: () =>
      Setting.values([
        'storeName',
        'supportEmail',
        'currency',
        'vatRate',
        'maintenanceMode',
        'checkoutAnnouncement',
        'lastChangedAt',
      ]),
    save: (input) => Setting.store({ ...input, lastChangedAt: DateTime.now() }),
  },
})
