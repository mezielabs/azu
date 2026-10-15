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

  /**
   * The name, logo and colour of the panel. Azu generates light and
   * dark palettes from the colour, adjusted where needed so text stays
   * readable. Dark mode follows the OS, with a toggle in the header.
   */
  brand: { name: 'Azu Store', logo: '/images/logo.svg', color: '#0d9488' },

  /**
   * Navigation group order. Groups not listed follow, by label.
   */
  navigation: { groups: ['Sales', 'Catalog'] },
})

export default adminConfig
