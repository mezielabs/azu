import vine from '@vinejs/vine'

/**
 * Shared rules for email and password.
 */
const email = () => vine.string().email().maxLength(254)
const password = () => vine.string().minLength(8).maxLength(32)

/**
 * Validator to use when performing self-signup.
 *
 * The "passwordConfirmation" field is declared explicitly, so that it is part
 * of the request body type shared with the frontend. Otherwise the signup form
 * has no way to know about the errors reported for this field.
 */
export const signupValidator = vine.create({
  fullName: vine.string().nullable(),
  email: email().unique({ table: 'users', column: 'email' }),
  password: password(),
  passwordConfirmation: password().sameAs('password'),
})

/**
 * Validator to use before validating user credentials
 * during login
 */
export const loginValidator = vine.create({
  email: email(),
  password: vine.string(),
})

/**
 * Editing a user in the public demo's Users resource (DEMO_MODE). Azu
 * passes `{ record }` as metadata: the user being edited, so their own
 * email doesn't count as taken. The role is optional because only
 * admins see that field.
 */
export const updateUserValidator = vine.create({
  fullName: vine.string().trim().maxLength(160).nullable(),
  email: email().unique({
    table: 'users',
    column: 'email',
    filter: (query, _value, field) => {
      query.whereNot('id', field.meta.record.id)
    },
  }),
  role: vine.enum(['admin', 'staff', 'viewer', 'customer'] as const).optional(),
})
