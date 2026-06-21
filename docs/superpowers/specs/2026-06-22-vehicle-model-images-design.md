# Vehicle Model Images — Design

**Date:** 2026-06-22
**Status:** Built — **pivoted to admin-uploaded images** (see Amendment).
**Scope:** Show a per-model car image wherever a vehicle appears (form preview, customer-detail cards, admin `/vehicles/:id`, customer portal). The Model field is a picker (+ "Other") so images map reliably.

> **Amendment (2026-06-22):** The owner did not like the AI-generated illustrations. Pivoted from baked-in AI assets to **admin-uploaded images managed in Settings**, one per model (+ a "default" slot for Other/unknown). AI PNGs removed. Resolution is now `resolveModelImage(model, map)` against a model→URL map loaded once via `ModelImagesProvider` (React context, default `{}` so `<VehicleImage>` needs no provider in tests); no upload → a neutral SVG car placeholder. Storage: public `vehicle-models` bucket + `vehicle_model_images(model_key, storage_path, updated_at)` table, per-customer-safe RLS (read = any authenticated, write = admin). Migration `0005_vehicle_model_images.sql`. The model picker, mapping helpers, and all surfaces from the original design are unchanged.

---

## 1. Decisions (locked)

| Area | Decision |
|------|----------|
| **Image source** | **Owned AI-generated illustrations**, one stylized image per model, stored as local bundled assets. Fallback if generation unavailable: hand-authored SVG car illustrations (still owned). **Never** hotlink/host VW press photos (licensing risk). |
| **Model capture** | Vehicle form's Model becomes a **Select** of known VW EV models + **"Other"** (reveals free-text). Stores a clean label string (e.g. `"ID.4"`). `vehicles.model` stays free-text — **no migration**. |
| **Mapping** | Pure `modelImage(model)`: normalize (lowercase, strip non-alphanumerics) → asset key; **unmatched/Other/legacy/typo → generic EV illustration** (always shows something). |
| **Surfacing** | One reusable `<VehicleImage>` everywhere: form preview, customer-detail cards, `/vehicles/:id`, portal vehicle page + home cards. |
| **Real photo upload** | Out of scope (YAGNI); easy to layer on `<VehicleImage>` later. |

---

## 2. Architecture

### Assets
- `src/assets/vehicles/`: `id3`, `id4`, `id5`, `id6`, `id7`, `idbuzz`, `generic` (PNG or SVG). Imported through Vite (hashed/bundled/cached). No external requests.

### Model catalog & mapping — `src/features/vehicles/models.ts`
- `VW_EV_MODELS: { key: string; label: string }[]` — id3…idbuzz.
- `normalizeModel(s)`: lowercase + strip non-alphanumerics.
- `modelImage(model: string | null): string` — normalized lookup; fallback `generic`. Pure, tested.

### Component — `src/features/vehicles/VehicleImage.tsx`
- Props: `model: string | null`, `size?: "sm" | "lg"`, `className?`.
- Renders `<img src={modelImage(model)} alt={model ?? "EV"} loading="lazy">` on a `bg-paper-2` rounded tile, `object-contain`.

### Model picker — in `VehicleForm.tsx`
- Controlled via react-hook-form `watch`/`setValue`:
  - Select options = catalog labels + "Other".
  - Selected = matching known label; else (non-empty unknown) → "Other" + free-text box bound to `model`.
  - Picking a known model writes the label and hides the box.
- Live `<VehicleImage>` preview beside the field.

### Surfaces (reuse `<VehicleImage>`)
- `CustomerDetailPage` vehicle cards — leading thumbnail.
- `VehicleDetailPage` — larger header image.
- Portal `PortalVehiclePage` header + `PortalHomePage` vehicle cards.

---

## 3. i18n
- Add `vehicles.modelOther` ("Other") and an alt fallback key to BOTH `en.json` and `ar.json` (parity test). Model labels themselves are brand strings — not translated.

---

## 4. Testing
- `models.ts`: `modelImage` normalization variants + generic fallback (pure).
- `VehicleImage`: resolved `src`/`alt`; unknown → generic.
- `VehicleForm`: picker lists models; "Other" reveals text box; submit writes chosen label; existing tests stay green.
- Build clean; preview EN + AR, no console errors.

---

## 5. Out of scope
- Real customer-car photo upload/override.
- Per-trim/color variants.
- Translating model names.
