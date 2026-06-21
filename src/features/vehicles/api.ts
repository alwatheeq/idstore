import { supabase } from "@/lib/supabase";

const BUCKET = "vehicle-models";

interface ModelImageRow {
  model_key: string;
  storage_path: string;
  updated_at: string;
}

/** Returns a map of model key → public image URL (cache-busted on update). */
export async function listModelImages(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from("vehicle_model_images").select("*");
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const row of (data ?? []) as ModelImageRow[]) {
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(row.storage_path);
    map[row.model_key] = `${pub.publicUrl}?v=${encodeURIComponent(row.updated_at)}`;
  }
  return map;
}

/** Upload (or replace) the image for a model slot; cleans up the previous file. */
export async function uploadModelImage(modelKey: string, file: File): Promise<void> {
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `${modelKey}/${crypto.randomUUID()}.${ext}`;
  const up = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
  if (up.error) throw up.error;

  const { data: prev } = await supabase
    .from("vehicle_model_images")
    .select("storage_path")
    .eq("model_key", modelKey)
    .maybeSingle();

  const { error } = await supabase
    .from("vehicle_model_images")
    .upsert({ model_key: modelKey, storage_path: path, updated_at: new Date().toISOString() });
  if (error) throw error;

  if (prev?.storage_path && prev.storage_path !== path) {
    await supabase.storage.from(BUCKET).remove([prev.storage_path]);
  }
}

export async function deleteModelImage(modelKey: string): Promise<void> {
  const { data: prev } = await supabase
    .from("vehicle_model_images")
    .select("storage_path")
    .eq("model_key", modelKey)
    .maybeSingle();
  const { error } = await supabase.from("vehicle_model_images").delete().eq("model_key", modelKey);
  if (error) throw error;
  if (prev?.storage_path) await supabase.storage.from(BUCKET).remove([prev.storage_path]);
}
