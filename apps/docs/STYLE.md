# Writing Azu's docs

Write like you're pairing with one developer who has an AdonisJS app open. They want their admin working, not a tour of Azu.

## Shape of a page

- **Lead with the problem, then the code.** One or two sentences on what the reader is trying to do, then the snippet that does it.
- **Interleave short explanation and short code.** A paragraph, a snippet, a paragraph. Don't stack three snippets or five paragraphs.
- **Steps are imperative.** "Add Bouncer", "Run `node ace codegen`". Number them when order matters.
- **Name what's awkward or unsupported, honestly.** If private disks don't work yet, say so where the reader would reach for one, and link the issue.
- **Gotchas get one sentence**, starting "Note:". Use a Starlight aside (`:::note`) when it would otherwise be missed. Use `:::caution` (Ember) only when ignoring it loses data or exposes something.

## Sentences

- Use "you" and the active voice: "Azu checks the policy", not "the policy is checked".
- Keep sentences under 20 words and paragraphs under four lines.
- Use the Oxford comma: "models, policies, and validators".
- Write numbers one to nine in words, and 10 and up in digits. Code, units, and versions stay as they are (`limit(5)`, 2mb, Node 24.21).
- No em dashes. Use a colon, a comma, parentheses, or a new sentence.
- Bold UI labels exactly as they appear: **Save changes**, **Users**, and **Columns**. Also use bold for defined terms and key warnings.

## Consistency

- Use British English in prose: colour, customise, authorisation, and licence. Keep API names such as `color` unchanged.
- Use **resource** for a model's admin pages, **screen** for a standalone admin page, and **record** for one model instance.
- Name the package when a version could be ambiguous: `@inertiajs/react` and `@adonisjs/inertia` have different versions.
- State the page's task and prerequisites before its steps. Tell readers how to check that the task succeeded.
- Describe current behaviour in installation and reference pages. Keep future work on the roadmap, clearly labelled as plans.

## Words to leave out

simply, just, easily, powerful, robust, seamless, in order to, utilize, as you can see.

Also skip filler like "basically", "it's worth noting", and "let's dive in".

## Code samples

Code comes from the demo app, not copies. Show a demo file, or a marked region of it, with `DemoCode`:

```mdx
import DemoCode from '../../../../components/DemoCode.astro'

<DemoCode file="app/admin/resources/product_resource.ts" region="columns" />
```

Mark the region in `apps/demo`:

```ts
// #region columns
columns: [ ... ],
// #endregion
```

In JSX, use `{/* #region name */}` and `{/* #endregion */}`. Regions can nest, and the markers never show on the page. A missing file or region fails the docs build.

Write a sample inline only when the demo can't have it: a shell command, or code for a different app (a starter kit's config, a placeholder like `you@example.com`). Keep those short.

## Links

- Link other docs pages with absolute paths and a trailing slash: `/docs/guides/filters/`. The build checks every internal link and heading anchor.
- Link issues by number: [#66](https://github.com/mezielabs/azu/issues/66).

## Checklist before you open a PR

- `pnpm docs:build` passes (it validates links).
- The page reads aloud without stumbling.
- Prerequisites, expected results, defaults, and unsupported cases match the implementation.
- New pages appear in the sidebar and are linked from the relevant guide.
- Search the page for the words to leave out, and for "—".
