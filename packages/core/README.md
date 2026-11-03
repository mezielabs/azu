# @mezielabs/azu

An admin panel for AdonisJS 7, built on your existing Lucid models, Bouncer policies, VineJS validators and Drive disks. MIT licensed.

This is a preview package. The API may change before a stable release. It pairs with the same preview version of `@mezielabs/azu-react`.

See the [installation and resource guide](https://github.com/mezielabs/azu#installation), [changelog](https://github.com/mezielabs/azu/blob/main/CHANGELOG.md), and [issue tracker](https://github.com/mezielabs/azu/issues).

Requires Node 24.21+, AdonisJS 7, Lucid, Auth, Bouncer, and Inertia with React. Drive is optional unless resources use file/image fields. Rich text and navigation icons have optional frontend peers; the guide covers configuration.

Install both packages with the `preview` tag, then configure:

```sh
npm i @mezielabs/azu@preview @mezielabs/azu-react@preview
node ace configure @mezielabs/azu
```

`@preview` goes away at 0.1.0, when `node ace add @mezielabs/azu` does both steps. Review the generated `accessAdmin` ability before granting admin access.
