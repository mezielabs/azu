import vine from '@vinejs/vine'
import { CURRENCIES } from '#validators/coupon'
import { decimalString, labelled, maxDecimal, twoPlaces } from '#validators/messages'

/**
 * The Store settings screen's validator (FR-23). Azu hands it only the
 * form's writable fields; "last changed" is set by the screen's `save`.
 */
export const storeSettingsValidator = labelled(
  vine.create({
    storeName: vine.string().trim().minLength(2).maxLength(80),
    supportEmail: vine.string().trim().email().maxLength(254),
    currency: vine.enum(CURRENCIES),
    // Stored as text, so kept in one format: "7.5" is saved as "7.50"
    vatRate: decimalString(0)
      .use(maxDecimal({ max: 100 }))
      .transform(twoPlaces),
    maintenanceMode: vine.boolean(),
    checkoutAnnouncement: vine.string().trim().maxLength(2000).nullable().optional(),
  }),
  {
    storeName: 'Store name',
    supportEmail: 'Support email',
    currency: 'Currency',
    vatRate: 'VAT rate',
    maintenanceMode: 'Maintenance mode',
    checkoutAnnouncement: 'Checkout announcement',
  },
  { email: '{{ field }} must be an email address' }
)
