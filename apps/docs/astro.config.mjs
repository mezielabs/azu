// @ts-check
import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'
import starlightLinksValidator from 'starlight-links-validator'

const site = 'https://azuadmin.com'

// The social card (public/og/azu.png, 1200x630), for every page. Starlight
// merges this after its own head tags and before a page's frontmatter head.
const socialCard = new URL('/og/azu.png', site).href
const socialCardAlt =
  'Azu, the back of your AdonisJS app. npm i @mezielabs/azu@preview @mezielabs/azu-react@preview'

export default defineConfig({
  site,
  trailingSlash: 'always',
  integrations: [
    starlight({
      title: 'Azu',
      description:
        'Azu is an admin panel for AdonisJS 7, built on your Lucid models, Bouncer policies, and VineJS validators.',
      favicon: '/favicon.svg',
      head: [
        { tag: 'meta', attrs: { property: 'og:image', content: socialCard } },
        { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
        { tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
        { tag: 'meta', attrs: { property: 'og:image:alt', content: socialCardAlt } },
        { tag: 'meta', attrs: { name: 'twitter:image', content: socialCard } },
        { tag: 'meta', attrs: { name: 'twitter:image:alt', content: socialCardAlt } },
      ],
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/mezielabs/azu' }],
      editLink: { baseUrl: 'https://github.com/mezielabs/azu/edit/main/apps/docs/' },
      customCss: [
        '@fontsource/instrument-sans/400.css',
        '@fontsource/instrument-sans/500.css',
        '@fontsource/instrument-sans/600.css',
        '@fontsource/instrument-sans/700.css',
        '@fontsource/jetbrains-mono/400.css',
        '@fontsource/jetbrains-mono/600.css',
        './src/styles/brand.css',
      ],
      // Code blocks: see ec.config.mjs (the brand theme, wrapping, diff tints)
      components: {
        SiteTitle: './src/components/SiteTitle.astro',
        // Adds Docs, Changelog and Roadmap links beside Starlight's own icons
        SocialIcons: './src/components/SocialIcons.astro',
        // Renders nothing on the landing page, whose Landing.astro owns its h1
        PageTitle: './src/components/PageTitle.astro',
      },
      plugins: [starlightLinksValidator()],
      sidebar: [
        {
          label: 'Get started',
          items: [
            { label: 'Introduction', slug: 'docs' },
            'docs/installation',
            'docs/quick-start',
            'docs/starter-kits',
            'docs/preview-limits',
          ],
        },
        {
          label: 'Guides',
          items: [
            'docs/guides/resources',
            'docs/guides/fields',
            'docs/guides/columns-and-lists',
            'docs/guides/filters',
            'docs/guides/relationships',
            'docs/guides/actions',
            'docs/guides/forms',
            'docs/guides/permissions',
            'docs/guides/validation',
            'docs/guides/uploads',
            'docs/guides/screens',
            'docs/guides/screen-forms',
            'docs/guides/home-and-navigation',
            'docs/guides/widgets',
            'docs/guides/trends',
            'docs/guides/customising',
            'docs/guides/theming',
          ],
        },
        {
          label: 'Reference',
          items: [
            'docs/reference/config',
            'docs/reference/commands',
            'docs/reference/doctor',
            'docs/reference/component-props',
            'docs/reference/errors',
          ],
        },
        'docs/troubleshooting',
        {
          label: 'Project',
          items: ['docs/changelog', 'docs/roadmap'],
        },
      ],
    }),
  ],
})
