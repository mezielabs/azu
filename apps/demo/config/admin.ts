import { defineConfig } from '@mezielabs/azu'

const adminConfig = defineConfig({
  /**
   * URL prefix the admin panel is mounted at
   */
  path: '/admin',

  /**
   * Where guests are sent to sign in. Admin routes use your app's default
   * auth guard; set "guard" to use another one.
   */
  loginUrl: '/login',

  /**
   * Resources in this directory load automatically. Set autoload to
   * false to register them in start/admin.ts instead.
   */
  resources: { autoload: 'app/admin/resources' },
})

export default adminConfig
