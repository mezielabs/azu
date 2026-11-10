import { defineConfig } from '@mezielabs/azu'
import { viewOrders } from '#abilities/main'

const azuConfig = defineConfig({
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
   * The account menu's "View site" link. Set it to false to hide it.
   */
  siteUrl: '/',

  // #region home
  /**
   * What /admin shows: the Overview screen from app/admin/screens (FR-22)
   */
  home: 'overview',
  // #endregion

  // #region autoload
  /**
   * Resources in this directory load automatically. Set autoload to
   * false to register them in start/azu.ts instead.
   */
  resources: { autoload: 'app/admin/resources' },
  // #endregion

  // #region brand
  /**
   * The name, logo and colour of the panel. Azu generates light and
   * dark palettes from the colour, adjusted where needed so text stays
   * readable. The theme follows the OS until the user picks Light or
   * Dark from the account menu.
   */
  brand: { name: 'Azu Store', logo: '/images/logo.svg', color: '#b0472a' },
  // #endregion

  // #region navigation
  /**
   * Navigation group order. Groups not listed follow, by label.
   */
  navigation: {
    groups: ['Sales', 'Catalog', 'Reports', 'Settings', 'Help'],
    // Links to any URL (FR-21). An ability would only hide one; its page checks access itself
    links: [
      {
        label: 'Awaiting shipping',
        url: '/admin/resources/orders?status=paid',
        group: 'Sales',
        icon: 'truck',
        order: 2,
        ability: viewOrders,
      },
      {
        label: 'Azu documentation',
        url: 'https://azuadmin.com/docs/',
        group: 'Help',
        icon: 'book-open',
      },
    ],
  },
  // #endregion
})

export default azuConfig
