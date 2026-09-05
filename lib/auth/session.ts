import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const operatingBranchCookie = "idstore_operating_branch";

export type CurrentStaff = {
  userId: string;
  displayName: string;
  role: "admin" | "staff";
  organizationId: string;
  branchIds: string[];
  selectedBranchId: string | null;
};

export const getCurrentStaff = cache(async (): Promise<CurrentStaff> => {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) redirect("/login");

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("memberships")
      .select("role, organization_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle(),
  ]);

  if (!profile || !membership) redirect("/login");

  const [{ data: branches }, cookieStore] = await Promise.all([
    supabase
      .from("branches")
      .select("id")
      .eq("organization_id", membership.organization_id)
      .eq("status", "active"),
    cookies(),
  ]);
  const branchIds = (branches ?? []).map((branch) => branch.id);
  const requestedBranchId = cookieStore.get(operatingBranchCookie)?.value ?? null;

  return {
    userId: user.id,
    displayName: profile.display_name,
    role: membership.role,
    organizationId: membership.organization_id,
    branchIds,
    selectedBranchId: requestedBranchId && branchIds.includes(requestedBranchId) ? requestedBranchId : null,
  };
});
