# IDstore Clear

Apple-inspired service operations UI; no Apple branding or affiliation.

## Structure

`app/apple.css` is the shared visual system, imported after `globals.css` in the root layout. Existing module layouts remain in the lower-priority `legacy` cascade layer, so new tokens and shared component styling do not need specificity overrides. Do not add new visual rules to the legacy layer.

Primitive colors feed semantic surface/text/action tokens and component tokens (`--card-padding`, `--card-bg`, `--field-bg`, `--button-bg`). The White & Navy palette uses light gray page backgrounds (`#f5f5f7`), slightly deeper light gray cards (`#f0f0f3`), white inputs (`#ffffff`), black text (`#111111`), and dark blue actions (`#18365d`). Card headers and bodies share `--card-bg`; editable fields and selected tabs stay white. Light gray navigation and slate-gray selections distinguish navigation from editable content. High-voltage warnings retain meaningful amber/red status colors; the finance summary retains a contrasting dark surface.

Use `--accent`, `--accent-hover`, `--accent-soft` and `--accent-selected` for new action and selection styling. Legacy `--blue*` names alias these tokens for compatibility. Muted text and action text must meet 4.5:1 contrast; field boundaries and keyboard focus must meet 3:1. Keep status labels alongside semantic colors so meaning never depends on color alone.

Use platform system typography for English and IBM Plex Sans Arabic for Arabic. Keep Arabic letter spacing at zero and numeric/phone/date values isolated LTR. Labels use sentence case, at least 13px, and nearby helper text.

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
