# Vehicle Model Images — Implementation Plan

**Date:** 2026-06-22
**Spec:** `docs/superpowers/specs/2026-06-22-vehicle-model-images-design.md`
**Branch:** `feat/vehicle-model-images`

## Step 1 — Generate assets
- Use the Gemini image-generator skill to produce consistent stylized illustrations: `id3`, `id4`, `id5`, `id6`, `id7`, `idbuzz`, `generic`. Same framing/style, transparent/light background.
- If generation unavailable: hand-author clean SVG car illustrations per body style + generic. Report which path was taken.
- Save under `src/assets/vehicles/`.

## Step 2 — Catalog & mapping (TDD)
- `src/features/vehicles/models.ts`: `VW_EV_MODELS`, `normalizeModel`, `modelImage` (imports each asset, returns URL; generic fallback).
- `models.test.ts`: normalization variants, known models, fallback.

## Step 3 — VehicleImage component
- `src/features/vehicles/VehicleImage.tsx` + test (resolved src/alt, unknown → generic).

## Step 4 — Model picker in VehicleForm
- Replace Model TextField with controlled Select (catalog + "Other") + conditional free-text; live `<VehicleImage>` preview.
- Update VehicleForm test (picker, Other reveals text, submit writes label).

## Step 5 — Surfaces
- `CustomerDetailPage` vehicle cards: leading thumbnail.
- `VehicleDetailPage`: header image.
- Portal `PortalVehiclePage` header + `PortalHomePage` cards.

## Step 6 — i18n
- `vehicles.modelOther` + alt fallback in en.json + ar.json.

## Step 7 — Verify
- `npm test` green (+ new), `npm run build` clean.
- Preview: vehicle form preview updates on model change; cards/detail/portal show images; EN + AR; no console errors; screenshot.
- `git status` for untracked assets/source.

## Step 8 — Wrap
- Update CLAUDE.md / memory; commit; push; await merge instruction.
