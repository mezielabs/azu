import env from '#start/env'

/**
 * The public demo at demo.azuadmin.com. Everything here applies only
 * with DEMO_MODE=true; with it off, the demo runs as it does locally
 * and in CI. See DEPLOY.md.
 */
const demoConfig = {
  /** DEMO_MODE, validated in start/env.ts */
  enabled: env.get('DEMO_MODE') === true,

  /**
   * The seeded accounts behind "Sign in as …" on the login page, by the
   * role the button names. The Editor is the demo's `staff` role. With
   * DEMO_MODE on, no one can change these accounts (UserPolicy).
   */
  accounts: {
    admin: 'admin@azu.test',
    editor: 'staff@azu.test',
    viewer: 'viewer@azu.test',
  },

  /** How often the hosting scheduler runs `node ace demo:reset`, for the banner */
  resetEveryMinutes: 60,

  /** Write requests (POST, PUT, PATCH, DELETE) allowed per IP address */
  writeLimit: { requests: 60, every: '1 minute' },

  /** The largest multipart request, so the largest upload */
  uploadLimit: '1mb',
} as const

export type DemoRole = keyof typeof demoConfig.accounts

export default demoConfig
