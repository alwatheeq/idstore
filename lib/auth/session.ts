import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveBranches } from "@/lib/auth/branches";

export const operatingBranchCookie = "idstore_operating_branch";

export type CurrentStaff = {
  userId: string;
  displayName: string;
  role: "admin" | "staff";
  organizationId: string;
  branchIds: string[];
  selectedBranchId: string | null;
  permissionCodes: string[];
};

/** Prefer the shell's operating branch over a stale or tampered form value. */
export function resolveOperatingBranch(staff: Pick<CurrentStaff, "selectedBranchId">, requestedBranchId: string | null | undefined) {
  return staff.selectedBranchId ?? requestedBranchId ?? null;
}

export const getCurrentStaff = cache(async (): Promise<CurrentStaff> => {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) redirect("/login");

  const [{ data: profile, error: profileError }, { data: membership, error: membershipError }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("memberships")
      .select("id, role, organization_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle(),
  ]);

  if (profileError || membershipError) throw new Error("Account access could not be loaded.");
  if (!profile || !membership) redirect("/login");

  const [branches, { data: permissionRows, error: permissionError }, cookieStore] = await Promise.all([
    getActiveBranches(membership.organization_id),
    membership.role === "staff"
      ? supabase.from("membership_permissions").select("permission_code, allowed").eq("membership_id", membership.id).eq("allowed", true)
      : Promise.resolve({ data: [] as { permission_code: string; allowed: boolean }[], error: null }),
    cookies(),
  ]);
  if (permissionError) throw new Error("Account permissions could not be loaded.");
  const branchIds = branches.map((branch) => branch.id);
  const requestedBranchId = cookieStore.get(operatingBranchCookie)?.value ?? null;

  return {
    userId: user.id,
    displayName: profile.display_name,
    role: membership.role,
    organizationId: membership.organization_id,
    branchIds,
    selectedBranchId: requestedBranchId && branchIds.includes(requestedBranchId) ? requestedBranchId : null,
    permissionCodes: membership.role === "admin" ? ["*"] : (permissionRows ?? []).map((permission) => permission.permission_code),
  };
});
