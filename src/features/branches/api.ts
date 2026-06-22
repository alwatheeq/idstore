import { supabase } from "@/lib/supabase";
import type { Branch, AdminProfile } from "./types";
import type { BranchPayload } from "./schema";

export async function listBranches(): Promise<Branch[]> {
  const { data, error } = await supabase
    .from("branches")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as Branch[];
}

export async function createBranch(payload: BranchPayload): Promise<Branch> {
  const { data, error } = await supabase.from("branches").insert(payload).select().single();
  if (error) throw error;
  return data as Branch;
}

export async function updateBranch(id: string, payload: BranchPayload): Promise<Branch> {
  const { data, error } = await supabase
    .from("branches")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Branch;
}

/** The current admin's branch access (null if not an admin). */
export async function getAdminProfile(userId: string): Promise<AdminProfile | null> {
  const { data, error } = await supabase
    .from("admin_users")
    .select("home_branch_id, can_access_all_branches")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as AdminProfile) ?? null;
}
