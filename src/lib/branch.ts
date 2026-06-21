import { supabase } from "@/lib/supabase";

let cached: string | null = null;

/** Returns the (single, Phase 1) branch id, fetching+caching it once. */
export async function getDefaultBranchId(): Promise<string> {
  if (cached) return cached;
  const { data, error } = await supabase.from("branches").select("id").limit(1).single();
  if (error) throw error;
  cached = data.id as string;
  return cached;
}
