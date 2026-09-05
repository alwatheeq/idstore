# 002 — Make the mobile navigation drawer spatial and interruptible

- **Status**: DONE
- **Commit**: e547dfe
- **Severity**: MEDIUM
- **Category**: Spatial consistency, interruption and accessibility
- **Estimated scope**: 2 files, approximately 40 lines

## Problem

The mobile navigation moves from the correct physical edge but uses a weak built-in curve, lacks a backdrop, and does not declare reduced-motion behavior.

```css
/* app/globals.css:557 — current */
.sidebar { position: fixed; left: 0; transform: translateX(-100%); width: 260px; transition: transform .2s ease; }
```

The menu button also lacks `aria-expanded` and `aria-controls`, and the drawer cannot be dismissed with Escape or a backdrop click.

## Target

Use a CSS transition on `transform` for the drawer and `opacity` for the backdrop, both at 240ms with `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)`. The drawer must originate from the inline-start edge in both LTR and RTL. It must be immediately reversible, close on Escape/backdrop/navigation, and expose its expanded state to assistive technology.

## Repo conventions to follow

- Mobile state already lives in `components/app-shell.tsx` as `menuOpen`.
- Responsive shell rules already live under `@media (max-width: 780px)` in `app/globals.css`.

## Steps

1. In `components/app-shell.tsx`, add `aria-expanded`, `aria-controls`, an ID on the sidebar, a backdrop button, and an Escape listener active only while open.
2. In `app/globals.css`, add the backdrop and replace the drawer transition with explicit `transform 240ms var(--ease-drawer)`.
3. Preserve left-origin LTR and right-origin RTL paths, including shadow direction.
4. Under reduced motion, shorten to 120ms, remove travel by using opacity for the backdrop, and keep the drawer state change clear.

## Boundaries

- Do NOT animate desktop navigation or keyboard shortcuts.
- Do NOT trap focus or hand-roll a modal; this remains a site-navigation drawer.
- Do NOT use keyframes because the drawer can be rapidly reversed.

## Verification

- **Mechanical**: run the standard typecheck, lint, build, and Playwright suite.
- **Feel check**: at mobile width, rapidly toggle the menu and confirm it retargets from its current position. Verify LTR enters from left and RTL from right. Verify backdrop and Escape close it. With reduced motion, confirm no sweeping travel remains.
- **Done when**: the drawer communicates physical origin, remains interruptible, and works equivalently in Arabic.
