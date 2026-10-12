import { defineConfig } from '@mezielabs/azu'

const adminConfig = defineConfig({
  /**
   * URL prefix the admin panel is mounted at
   */
  path: '/admin',
})

export default adminConfig
