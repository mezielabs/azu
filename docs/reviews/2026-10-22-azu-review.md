**Azu — consolidated code, UI/UX, and release-readiness review**

Prepared: 22 October 2026. Status baseline: `cc38025`, the `origin/main` snapshot used for the latest review. This report consolidates the earlier code review, product-readiness assessment, UI/UX review, subsequent fixes, and latest re-review in this chat.

**Assessment and scope**

Azu's layout and everyday editing experience have improved substantially since the first review. Mobile navigation, list controls, account access, form layout, and display formatting received concrete fixes. The three original relationship-integrity defects were addressed in PR #28. The latest review nevertheless reproduced three outstanding correctness bugs and identified remaining usability and release-preparation work.

The latest review ran in a separate worktree, with detached HEAD at `cc38025` (widgets and metrics, #44). The primary workspace stayed on local `main` at `419aa13`; it was not the source of the latest findings. The old `fix/relationship-form-integrity` branch was not the re-review target. Statuses below apply to this reviewed snapshot, not to unexamined later commits or live npm/GitHub state.

Evidence combines code inspection, targeted SQLite regressions, browser checks, and screenshots. The original UX inspection included a 375px viewport; the latest captures used 1280px desktop and 390px mobile layouts in light and dark themes. “Resolved” means supported by the merged implementation and prior validation, not that every historical scenario was rerun in the latest pass.

Priority labels: **P1** denotes the historical data-loss defect; **P2** denotes actionable defects that should be fixed promptly. **Enhancement** denotes a workflow improvement or a deferred product decision. Release checks are gates to verify, not claims that the application currently fails them.

**Outstanding issue register**

| ID | Issue | Status and evidence | Priority / timing |
| --- | --- | --- | --- |
| C01 | Old widget responses overwrite the selected date range | Open; browser regression reproduced | P2; before preview |
| C02 | Partition “Other” sums non-additive aggregates | Open; average regression reproduced, min/max identified in shared code path | P2; before preview |
| C03 | Duplicate pivots exhaust the visible-row limit | Open; real Lucid regression reproduced | P2; before preview |
| U01 | Currency value overflows dashboard card | Open; desktop screenshots in both themes | P2; before preview |
| U02 | Login loses the requested admin destination | Open; earlier live observation, current source confirmation | P2; demo/integration fix |
| U03 | Delete confirmation lacks record identity and consequence | Open; current dialog and built-in action copy | P2; before preview |
| U04 | Custom SKU field omits required/error semantics | Open; current demo component | P2; before preview |
| U05 | Mobile list lacks sorting and bulk selection | Open; intentional current limitation | Workflow enhancement |
| U06 | Mobile record titles and details truncate excessively | Open; mobile screenshot | Usability improvement |
| U07 | Touch sizing remains inconsistent across controls | Partly resolved; current styles | Targeted usability pass |
| U08 | Forms lack named sections | Deferred; documented public API decision | Enhancement |
| U09 | Hidden columns cannot be revealed with a built-in control | Open; table/card rendering and absent control | Enhancement |
| R01 | Preview packaging and release workflow incomplete | Open in reviewed repository | Release gate |
| R02 | Full release-commit verification still needed | Not established by this review | Release gate |
| R03 | i18n requirement differs from implementation | Open contract mismatch | Resolve before claiming compliance |
| R04 | Private uploads/signed URLs unsupported | Documented deferral; visibility in user docs needs improvement | Document before preview |
| R05 | Roadmap still presents implemented capabilities as future work | Partly outdated | Documentation cleanup |

**C01 · Stale widget responses can show the wrong period's data**

Changing the date range first updates the range prop, then starts separate widget reloads. Those reloads are not tied to a generation that prevents an older response from replacing newer data.

Reproduction: load Overview with 30 days selected and 13 orders; switch to 7 days while holding the Orders response; switch back to 30 days and let its data arrive; release the delayed 7-day response. The Orders figure becomes **3 while the selected range remains 30 days**, instead of staying at 13. Administrators can therefore make decisions using values labelled with the wrong period.

Recommended fix: cancel obsolete widget requests or reject responses whose range/generation is no longer current. Account for initial deferred loads, retries, and rapid repeated changes as well as the range-switch handler.

Acceptance: an intentionally delayed old response never replaces the current range's values; loading and error states remain associated with the correct range; retrying one widget does not corrupt the others.

Source: [range_switch.tsx:19](../../packages/react/src/components/widgets/range_switch.tsx). Evidence: browser reproduction (`2026-10-22-evidence/review_widgets.spec.ts`), browser log (`2026-10-22-evidence/browser.log`).

**C02 · Partition “Other” is incorrect for averages, minimums, and maximums**

Partition widgets support non-additive operations, but combine omitted groups by adding their aggregate values. The total and percentage calculations also sum group aggregates, which needs a defined meaning for non-additive metrics.

Reproduction: create three one-order status groups with values 100, 20, and 10; configure an average partition with a visible limit of one. The remaining groups appear as **Other = 30.00**, although their combined average is **15.00**. In real datasets with unequal group sizes, averaging group averages would also be wrong; the calculation must account for underlying records. Minimum and maximum use the same incorrect summing path, although only the average case was executed as a regression.

Recommended fix: recompute the requested aggregate over omitted records, or explicitly restrict partition widgets to count and sum. Define what total, relative bars, and percentages mean for each supported operation. Restricting the public API would require an explicit product/API decision.

Acceptance: count/sum retain correct behavior; averages cover unequal group sizes; min/max return the omitted records' extrema; empty and tied groups remain deterministic; displayed percentages have a documented, meaningful interpretation.

Source: [compute.ts:402](../../packages/core/src/widgets/compute.ts). Evidence: regression patch (`2026-10-22-evidence/regression-tests.patch`), metric log (`2026-10-22-evidence/metrics.log`).

**C03 · Duplicate pivot rows still lock a fully visible relationship at the limit**

The earlier follow-up correctly changed the attachment count to distinct related keys. However, the visible-attachment query still limits raw joined rows to 200 before JavaScript deduplication. Duplicate rows can crowd out a different, fully accessible attachment.

Reproduction: attach one tag through 202 pivot rows and a second tag through one row, with no scope hiding either tag. The distinct count is two, but the first 200 query rows represent only one key. The field becomes read-only and says that some attached tags are hidden. This is a remaining edge case in the duplicate-pivot fix, not evidence that the original hidden-attachment data-loss bug has returned.

Recommended fix: apply the bound to distinct related keys before loading display records. Preserve resource scoping, configured relation keys, deterministic ordering, and the legitimate over-limit protection. Adding a pivot uniqueness constraint alone would not handle existing duplicates or arbitrary host schemas.

Acceptance: repeated rows cannot displace another visible key; genuinely hidden attachments still prevent replacement; over-200 distinct selections remain protected; custom keys and checks on submission continue to work.

Source: [relations.ts:184](../../packages/core/src/records/relations.ts). Evidence: regression patch (`2026-10-22-evidence/regression-tests.patch`), relationship log (`2026-10-22-evidence/duplicate.log`).

**U01 · Currency figures overflow dashboard cards**

At 1280px, the Revenue figure “NGN 194,000.00” extends beyond its card in both themes. The fixed 28px figure styling does not adequately accommodate currency content at the available width. This undermines dashboard readability even when the underlying value is correct.

Use content-aware sizing, a wider currency card, or a separate currency label. Do not silently truncate monetary values. Verify long amounts, negative values, currency identifiers, narrow desktop widths, and browser zoom.

Source: [styles.css:2069](../../packages/react/src/styles.css). Evidence: light desktop (`2026-10-22-evidence/images/overview-light.png`), dark desktop (`2026-10-22-evidence/images/overview-dark.png`).

**U02 · Login does not return users to their requested admin page**

The earlier live review reached the starter dashboard after signing in from `/admin`. The current demo login controller still redirects unconditionally to `dashboard`. Account identity, logout, and View site have since been added, so the unresolved portion is the entry/return journey.

Preserve an intended local destination through authentication, with a suitable fallback, while continuing to enforce access checks on the destination. Do not accept arbitrary external return URLs. Exercise both the admin home and a bookmarked edit/list URL. This is directly confirmed in the demo; each consuming application's authentication flow remains its own integration responsibility.

Source: [session_controller.ts:15](../../apps/demo/app/controllers/session_controller.ts).

**U03 · Destructive confirmation lacks context**

The built-in row action still asks “Delete this product?” without identifying the record or explaining the consequence. The confirmation component receives count and resource nouns, but no dedicated record-title prop. Users acting from similar rows have less opportunity to catch a mistake.

For the built-in permanent deletion, name the record and state that it cannot be undone. Bulk confirmation should identify the count and whether it covers selected or all matching records. Custom actions should describe their actual effect rather than inheriting an inaccurate permanence warning. Preserve Cancel-first focus and disabled controls while submitting.

The earlier recommendation to always hide Delete in a menu was superseded by the chosen shared action rule: small action sets may remain visible, larger sets use a menu, destructive actions come last, and Edit remains primary. That placement decision is not reopened by this report.

Sources: [define_resource.ts:187](../../packages/core/src/resources/define_resource.ts), [action_dialog.tsx:67](../../packages/react/src/components/actions/action_dialog.tsx).

**U04 · The custom SKU field lacks required and error semantics**

The demo's custom SKU control has a label and `aria-invalid`, but omits the required marker/semantics and an explicit association between its error text and input. Built-in controls have stronger conventions, making this both a demo inconsistency and a poor example for developers copying custom fields.

Render the field's required state, associate the error using a stable ID and `aria-describedby` or equivalent supported semantics, and preserve the field contract. Verify required status and errors with keyboard and screen-reader checks. This finding concerns the custom SKU component, not all built-in inputs.

Source: [sku_input.tsx:7](../../apps/demo/inertia/admin/components/sku_input.tsx).

**U05 · Mobile lists lack sorting and bulk-selection controls**

Below 768px the card view replaces the desktop table. It does not expose the desktop sort or selection callbacks, so mobile users cannot choose a sort order or start batch operations through the UI. The decision log explicitly acknowledges the bulk-action limitation; this is a missing workflow rather than an accidental disappearance of an implemented mobile feature.

Add an accessible sort control and an explicit selection mode, subject to the product decision to support mobile bulk operations. Keep current query/filter state and server authorization rules. Verify clearing selection, paging, all-matching semantics, destructive confirmation, and returning to normal card navigation.

Source: [resource/index.tsx:256](../../packages/react/src/pages/resource/index.tsx).

**U06 · Mobile record names and details truncate too aggressively**

At 390px, thumbnails, status badges, prices, and action menus leave too little room for record identity. Examples include “Ceramic serving b…” and a category shortened to “Kitch…”. Frequent detail-page visits are then necessary just to distinguish records.

Allow two-line titles and give secondary information its own line; reposition badges without sacrificing the accessible action menu. Evaluate similar long names, missing images, long status labels, and large prices. Exact layouts are recommendations rather than approved redesigns.

Source: [list_cards.tsx:51](../../packages/react/src/components/list/list_cards.tsx). Evidence: mobile light (`2026-10-22-evidence/images/mobile-light.png`), mobile dark (`2026-10-22-evidence/images/mobile-dark.png`).

**U07 · Touch-target improvements are incomplete**

The original review measured approximately 34px inputs, 30px buttons, and 22px editor tools. Those historical measurements must not be treated as current measurements. Current styles enlarge mobile save actions, list controls, navigation controls, and coarse-pointer editor tools to 44px. General form inputs still lack a consistent mobile minimum height.

Complete a targeted touch inspection across forms, dialogs, relation controls, pagination, and custom fields. A 44px target is the proposed usability baseline, not a claim that every smaller control automatically fails WCAG 2.1 AA. Verify spacing as well as the visible control size.

Sources: [form input styles](../../packages/react/src/styles.css), [mobile save actions](../../packages/react/src/styles.css), [coarse-pointer editor controls](../../packages/react/src/styles.css).

**U08 · Named form sections remain deferred**

Reading width, paired short fields, sticky actions, unsaved-state feedback, and alternative save actions address much of the original form critique. Fields still sit in one panel in declaration order, without groups such as Details, Pricing, Organisation, or Media.

The decision log explicitly deferred sections because resources have no grouping API. Treat this as an enhancement requiring a public API decision, not a regression. If adopted, define headings, group order, conditional/empty sections, error navigation, and narrow-screen behavior before implementation.

Reference: [form-layout decision](../../docs/decisions.md).

**U09 · Hidden columns have no built-in reveal control**

Both table and card rendering filter out `hiddenByDefault` columns. No built-in Columns selector lets an administrator reveal them, so “hidden by default” behaves as persistently hidden in the standard list UI. This matters especially when generated resources hide columns automatically.

Provide a column-visibility control with a reset to resource defaults, or clarify the intended contract. Decide persistence and mobile behavior explicitly. A visibility selector must never expose data omitted by server authorization. This recommendation is independent of the already-completed toolbar simplification.

Sources: [data_table.tsx:93](../../packages/react/src/components/list/data_table.tsx), [list_cards.tsx:26](../../packages/react/src/components/list/list_cards.tsx).

**Release-readiness and documentation findings**

| ID | Current evidence | Required next outcome |
| --- | --- | --- |
| R01 — Packaging | Both package manifests remain at `0.0.0`; repository/homepage/bugs/keyword metadata and package READMEs are absent. No root changelog or release workflow is present; only `ci.yml` is available. | Prepare coordinated preview versions, package metadata/READMEs, changelog, and release workflow. Repack and inspect the versioned artifacts, including rewritten workspace peers. Publishing and npm organization configuration remain separate owner-controlled steps. |
| R02 — Verification | CI defines SQLite/Postgres/MySQL coverage, a bundle check, and generator proof. Browser installation names Chromium. The latest local review did not rerun the complete release matrix or benchmarks. | Verify the actual release commit with full tests, lint/typecheck, bundle budget, generator proof, doctor, fresh-app installation, and list/widget benchmarks. Add Firefox/WebKit checks to substantiate compatibility, and retain explicit narrow-viewport checks. Do not infer a missing mobile test suite: current browser tests already include phone scenarios. |
| R03 — i18n | The specification says all UI strings pass through AdonisJS i18n; current UI components contain English literals. | Implement translation plumbing or explicitly revise/defer the requirement. English-only launch content and translation-ready architecture are separate claims. |
| R04 — Upload limitations | File URLs use Drive `getUrl`; the specification explicitly defers private disks and signed URLs. The README lacks an equally clear user-facing limitation near upload usage. | Make the limitation prominent for preview users. Treat private-file support as deferred capability, not as implemented functionality. No unauthorized file-access exploit was demonstrated in this review. |
| R05 — Roadmap | The README still lists all-filtered-row bulk actions under v1.1, and the specification's milestone table lists already-implemented FR-09/15/16/17 as future items. | Reconcile implemented features, planned extensions, and release dates. Keep historical decision entries as history; update current roadmap claims. |

References: [release checklist](../../docs/release.md), [CI configuration](../../.github/workflows/ci.yml), [i18n requirement](../../docs/spec.md), [upload implementation](../../packages/core/src/files/uploads.ts), [README roadmap](../../README.md).

The earlier fresh-app tarball installation and packaging checks were useful evidence for their tested versions. They do not establish readiness of a later versioned release. The tracked release checklist itself contains historical measurements that need refreshing at release time.

**Disposition of the original findings**

| Earlier finding | Resolution in the reviewed snapshot | Remaining qualification |
| --- | --- | --- |
| P1: unchanged scoped relationship save detaches hidden records | PR #28 makes incomplete selections read-only and repeats the protection on submission | C03 is a false-read-only edge case; it does not re-establish the original data-loss finding |
| P2: clearing all tags fails during a file upload | Explicit empty selection survives multipart encoding and is restored before validation | Keep the existing browser regression |
| P2: custom relation keys submit primary-key values | Pickers/options use configured relation keys; record links keep primary keys | Keep real Lucid custom-key coverage |
| Duplicate pivot rows counted as multiple attachments | Distinct attachment count and revised reason text implemented | Incomplete at the display limit; C03 |
| Mobile navigation consumes the first screen | Drawer navigation and filter sheet implemented; mobile cards replace the table | U05/U06 cover separate remaining mobile limitations |
| Missing identity, logout, and return-to-site controls | Sidebar account menu and View site implemented | Login return destination remains U02 |
| Form layout too wide/long and Save only at bottom | Constrained width, paired fields, sticky save bar, unsaved status; additional save modes | Named sections remain U08 |
| Excessive list controls and duplicate low-stock shortcut | Consolidated toolbar, context-specific bulk bar, footer counts; duplicate notice removed | Column visibility remains U09 |
| Row menu lacks View/Edit | Permission-aware View/Edit links added, including mobile menus | No outstanding finding on this point |
| Empty results say only “No records” | Distinct empty/search/filter messages and clear actions implemented | No outstanding finding on this point |
| Validation exposes internal field names | Demo validators provide readable labels/messages | SKU custom-field semantics remain U04; host applications still own validation messages |
| Price/status presentation differs between list and detail | Shared formatting, status badges, edit currency prefixes | New dashboard overflow is U01 |
| SKU capitalisation inconsistent | Acronym-aware labels implemented | Required/error semantics are a separate issue |
| Delete competes with Edit | Shared action rule adopted; Edit is primary | Blanket “always hide Delete” recommendation superseded; confirmation remains U03 |
| Small mobile controls | Several targeted 44px controls implemented | Full consistency is not established; U07 |

The earlier PR merge conflict was resolved during that work and is not an outstanding product issue. Soft deletes, global search, and proposed Pro capabilities were discussed as deferrable scope, not reproduced defects; they are not added to the mandatory fix list here.

**Validation record and limits**

| Review stage | Evidence recorded | Limit |
| --- | --- | --- |
| Original code review | Build passed; 178 core and 138 SQLite functional tests passed; focused checks exposed three uncovered edge cases | No Postgres/MySQL or browser run in that initial pass |
| Original fixes | Build, typecheck, lint, 179 core and 173 demo tests passed (352 total); screenshot-generation test skipped by default | Historical results for the fix version |
| Distinct-count follow-up | Build, typecheck, lint, 180 core tests and 11 relationship tests passed | Did not cover duplicate rows crowding out another key at the display limit |
| Latest re-review | Package builds passed; 2 core, 13 functional, and 8 browser checks passed; one intentional failing regression in each group | 23 passes and 3 reproduced failures; focused coverage, not a complete release run |
| UI/accessibility checks | Light/dark desktop/mobile captures; existing dashboard accessibility checks passed | Not a complete WCAG audit, screen-reader audit, cross-browser certification, or review of every resource |

The pinned pnpm version could not supply a native binary for the review host. Dependency installation used the available pnpm version with its package-manager mismatch override, and package builds were invoked directly. This environment workaround should not be confused with a successful run of the repository's unchanged end-to-end build command on its pinned toolchain.

Temporary regression edits were removed after preserving their evidence. No implementation fix is included in this report. Current report preparation rechecked source and documentation; it did not rerun all tests or fetch a newer `origin/main`.

**Recommended implementation order**

1. Fix C01–C03 with focused regressions, then run the relevant database/browser coverage. Preserve the already-fixed relationship safety behavior.
2. Correct U01–U04: readable financial figures, successful login return, contextual deletion, and accessible custom fields.
3. Address mobile usability U05–U07. Separate the product decision about mobile bulk operations from straightforward title and touch-target improvements.
4. Decide the public contracts for U08/U09 and R03. Form grouping, column visibility, and translation plumbing should be deliberate API choices.
5. Complete R01/R02/R04/R05 on the actual release commit. Use the tracked release checklist and record fresh results rather than carrying historical counts forward.

For each fix, retain its issue ID in the implementation notes, add the smallest regression that demonstrates the reported failure, and record the verified commit. Use screenshots for layout changes and behavior checks for workflow changes. These proposed work items are recommendations; this report does not authorize publishing or change previously agreed product decisions.

**Evidence package**

The adjacent `2026-10-22-evidence` directory (kept out of the repository, so the evidence files below are named rather than linked) contains the regression patch, browser reproduction, screenshot capture source, test/build logs, and eight screenshots. The patch modifies existing tests for diagnosis; the browser reproduction includes copied existing tests. They are evidence from the reviewed snapshot and should be converted into clean, focused permanent regressions when implementing fixes.

Useful entry points: test patch (`2026-10-22-evidence/regression-tests.patch`), browser reproduction (`2026-10-22-evidence/review_widgets.spec.ts`), capture source (`2026-10-22-evidence/review_capture.spec.ts`), form light (`2026-10-22-evidence/images/form-light.png`), list light (`2026-10-22-evidence/images/list-light.png`). Source links elsewhere in the report point to the retained review worktree at `cc38025`.
