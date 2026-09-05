# 001 — Establish crisp workshop motion tokens and action feedback

- **Status**: DONE
- **Commit**: e547dfe
- **Severity**: HIGH
- **Category**: Easing, performance, accessibility and cohesion
- **Estimated scope**: 1 file, approximately 45 lines

## Problem

High-frequency navigation currently animates every changed property with an unspecified transition, and the interface has no shared motion tokens or reduced-motion contract.

```css
/* app/globals.css:50 — current */
.nav-item { ... transition: .18s ease; }
```

Buttons and action-result feedback have no consistent press or entrance response, so command acknowledgement feels less precise than the underlying transactional workflows.

## Target

Define these shared tokens in `app/globals.css`:

```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
--duration-press: 120ms;
--duration-feedback: 180ms;
--duration-drawer: 240ms;
```

Navigation color/background changes use a 120ms `ease` transition only. Buttons use `transform: scale(.98)` on active for feedback. Record feedback and occasionally opened operation forms enter with opacity and a maximum `translateY(4px)` over 180ms using `--ease-out`. Reduced motion keeps opacity/color feedback but removes positional transforms.

## Repo conventions to follow

- Shared visual tokens already live in `:root` in `app/globals.css`.
- Existing semantic classes `.button`, `.record-feedback`, `.operation-form`, and `.nav-item` are the implementation points.
- No animation dependency is installed; use CSS only.

## Steps

1. Add the exact easing and duration tokens to `:root` in `app/globals.css`.
2. Replace `.nav-item`'s broad transition with explicit `color` and `background-color` transitions at 120ms `ease`.
3. Add explicit button color, border, background, and transform transitions; gate hover transforms behind `(hover: hover) and (pointer: fine)` and use `scale(.98)` only for `:active`.
4. Use `@starting-style` with only `opacity` and `transform` for `.record-feedback` and `.operation-form`, keeping feedback interruptible without replaying a keyframe.
5. Add `@media (prefers-reduced-motion: reduce)` that removes position transforms and shortens drawer/feedback motion while retaining opacity/color feedback.

## Boundaries

- Do NOT animate tables, keyboard search, or every page navigation; these are high-frequency work surfaces.
- Do NOT add a motion library.
- Do NOT use `transition: all`, `ease-in`, layout-property animation, or `scale(0)`.

## Verification

- **Mechanical**: run `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run test:e2e` with all passing.
- **Feel check**: press primary and secondary buttons; feedback must register without visible bounce. Open an operation form and trigger a success/error message at 10% playback speed; the 4px path must be subtle and never obscure text. Toggle reduced motion and confirm the positional movement disappears while state colors remain.
- **Done when**: no broad transition remains in the shared shell, button feedback is immediate, action feedback is legible, and reduced-motion behavior is explicit.
