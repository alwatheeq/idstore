# IDstore Clear

Apple-inspired service operations UI; no Apple branding or affiliation.

## Structure

`app/apple.css` is the shared visual system, imported after `globals.css` in the root layout. Existing module layouts remain in the lower-priority `legacy` cascade layer, so new tokens and shared component styling do not need specificity overrides. Do not add new visual rules to the legacy layer.

Primitive colors feed semantic surface/text/action tokens and component tokens (`--card-padding`, `--card-bg`, `--field-bg`, `--button-bg`). The White & Navy palette uses light gray page backgrounds (`#f5f5f7`), slightly deeper light gray cards (`#f0f0f3`), white inputs (`#ffffff`), black text (`#111111`), and dark blue actions (`#18365d`). Card headers and bodies share `--card-bg`; editable fields and selected tabs stay white. Light gray navigation and slate-gray selections distinguish navigation from editable content. High-voltage warnings retain meaningful amber/red status colors; the finance summary retains a contrasting dark surface.

Use `--accent`, `--accent-hover`, `--accent-soft` and `--accent-selected` for new action and selection styling. Legacy `--blue*` names alias these tokens for compatibility. Muted text and action text must meet 4.5:1 contrast; field boundaries and keyboard focus must meet 3:1. Keep status labels alongside semantic colors so meaning never depends on color alone.

Use platform system typography for English and IBM Plex Sans Arabic for Arabic. Keep Arabic letter spacing at zero and numeric/phone/date values isolated LTR. Labels use sentence case, at least 13px, and nearby helper text.

## Alignment rules

- Use the shared 46px control height and 14px typography for inputs, selects and standard buttons (16px on mobile). Compact actions may be smaller only when they are not paired with inputs.
- Dashboard scope labels sit above the dropdown. Its Apply button shares the dropdown baseline and height. Locked branch controls use a muted background, not a permanent focus ring.
- Assignment, finance, estimate, inspection toolbar and inline table forms use the same control height, radius and type size. Controls wrap as needed without shrinking below readable sizes.
- Grid forms own their row spacing; direct fields have no bottom margins. Standalone stacked fields retain their spacing.
- Record search, facet and grouped actions align at the bottom on wide cards. Below 700px card width, search gets a full row; below 440px, controls stack and the action buttons share a row equally.
- Forms inside cards narrower than 560px switch to one column, even on a desktop screen. Do not size nested forms from viewport width alone.
- Metric tiles share row heights and padding. Arabic values align right with their labels, while the numbers themselves stay LTR.
- Panel headers, forms and table edges share card padding. Related panels use the shared section gap.

## Responsive behavior

- Desktop: grouped sidebar, two-column forms, horizontally scrollable data tables.
- Up to 780px: single-column working forms, 16px inputs, 44px minimum primary touch targets, safe-area-aware bottom navigation.
- Tabs scroll horizontally instead of shrinking their labels.
- Mobile drawer: trapped keyboard focus, inert background, Escape dismissal, focus restoration, close on desktop resize.
- Shortcuts use the same visible-route permissions as the sidebar; creating a work order requires `repair_order.manage` or Admin.
- Motion is limited to brief feedback and drawer transitions. Reduced motion, transparency and increased contrast preferences have explicit alternatives.

## Verification

`tests/e2e/apple-layout.spec.tsx` renders the real AppShell with synthetic data at 390, 768 and 1280px in English and Arabic. It checks containment, touch typography, LTR phone entry and role-limited shortcuts. Inspection layout and login accessibility tests also load the new style. The live local app was checked for drawer focus wrapping and Escape dismissal without saving customer data.

These tests do not imply every authenticated workflow has been exercised. Keep verifying specialized screens when changing their layout or colors.

## Control audit

Run `npm run ui:check` for the source-level label audit (354 native controls and 330 button/link actions across 51 TSX files at this revision). Labels must be associated through `htmlFor`/`id` or wrap their control. Placeholders alone are not labels. Compact topbar search and the country-code portion of composite phone fields use accessible names instead of extra visible captions. The label and Arabic-coverage audits are also release gates in CI.

Use `LabeledControl` for repeated inline/table forms: one persistent caption and one native control. It preserves names, values, events and server actions, without generating duplicate IDs. Render repeated item identity separately from its editable field label. Use `field-label` for the caption when an existing wrapping label is appropriate.

Cash, campaign, job, stock, evidence-upload and inspection-filter forms share the same sizing tokens. Keep labels above fields and action buttons bottom-aligned; wrap entire labeled fields instead of squeezing the input. File inputs retain their native picker and visible filename. The topbar uses the same 46px control height.

The additional operational-control tests run at 360, 768, 1086 and 1440px in English and Arabic. They check label association, card containment, caption spacing, input/button heights, font sizes, corner radius and preservation of form values. Translation coverage runs separately with `npm run i18n:check`; generated translations still need human terminology review.
