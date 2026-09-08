import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/** Request-local only: never cache branch access across users or requests. */
export const getActiveBranches = cache(async (organizationId: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("branches").select("id, code, city, display_name")
    .eq("organization_id", organizationId).eq("status", "active").order("city");
  if (error) throw new Error("Branch access could not be loaded.");
  return data ?? [];
});
