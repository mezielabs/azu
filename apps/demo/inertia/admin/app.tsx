/**
 * Azu's admin entry. Only /admin pages load this file, so none of the
 * admin code reaches your public pages.
 *
 * Pages in ./pages override Azu's pages of the same name, and components
 * in ./components can be used with .component('Name') or a resource's
 * slots, registered by file name (sku_input.tsx becomes SkuInput). Each
 * component loads only when a page that uses it opens.
 */
import '@mezielabs/azu-react/styles.css'
import { createAzuApp } from '@mezielabs/azu-react'

createAzuApp({
  pages: import.meta.glob('./pages/**/*.tsx'),
  components: import.meta.glob('./components/**/*.tsx'),
})
