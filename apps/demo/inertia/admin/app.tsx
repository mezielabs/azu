/**
 * Admin Vite entry. Only `/admin` pages load this file, so none of it
 * reaches the public pages. `node ace add @mezielabs/azu` will write it.
 */
import '@mezielabs/azu-react/styles.css'
import { createAzuApp } from '@mezielabs/azu-react'

createAzuApp({
  pages: import.meta.glob('./pages/**/*.tsx'),
  components: import.meta.glob('./components/**/*.tsx', { eager: true }),
})
