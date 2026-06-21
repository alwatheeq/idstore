/** Known VW EV models, in display order. `label` is what gets stored in vehicles.model. */
export const VW_EV_MODELS = [
  { key: "id3", label: "ID.3" },
  { key: "id4", label: "ID.4" },
  { key: "id5", label: "ID.5" },
  { key: "id6", label: "ID.6" },
  { key: "id7", label: "ID.7" },
  { key: "idbuzz", label: "ID. Buzz" },
] as const;

/** Slot key used for the fallback image applied to "Other"/unknown models. */
export const DEFAULT_MODEL_KEY = "default";

/** Lowercase + strip non-alphanumerics: "ID.4" / "id 4" / "ID4" → "id4". */
export function normalizeModel(model: string | null | undefined): string {
  return (model ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** The catalog entry whose label matches the stored model (normalized), if any. */
export function findModel(model: string | null | undefined) {
  const n = normalizeModel(model);
  return VW_EV_MODELS.find((m) => m.key === n);
}

/**
 * Resolve a vehicle's admin-uploaded image URL from the model→URL map.
 * Falls back to the "default" slot, then null (caller shows a placeholder).
 */
export function resolveModelImage(
  model: string | null | undefined,
  images: Record<string, string>,
): string | null {
  return images[normalizeModel(model)] ?? images[DEFAULT_MODEL_KEY] ?? null;
}
