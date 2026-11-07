# @mezielabs/azu-react

Inertia + React pages, components and prebuilt styles for [Azu](https://github.com/mezielabs/azu), the AdonisJS admin panel. MIT licensed.

This preview pairs with the same version of `@mezielabs/azu`; it is not a standalone admin application. The API may change before a stable release. Install both packages with the `preview` tag, then configure (the [Azu installation guide](https://azuadmin.com/docs/installation/) has the rest):

```sh
npm i @mezielabs/azu@preview @mezielabs/azu-react@preview
node ace configure @mezielabs/azu
```

Use this two-step installation for the current preview.

React 19 and Inertia 3 are required. Tiptap and Lucide are optional peers. Import the package stylesheet as `@mezielabs/azu-react/styles.css`; the configure command sets up the separate admin entry point. Source pages ship for `node ace azu:publish` overrides.

See the [documentation](https://azuadmin.com/docs), [customising Azu](https://azuadmin.com/docs/guides/customising/), the [changelog](https://github.com/mezielabs/azu/blob/main/CHANGELOG.md), and [issue tracker](https://github.com/mezielabs/azu/issues).
