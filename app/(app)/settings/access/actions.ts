"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formText, operationError, routeMessage } from "@/lib/actions/form";
import { getCurrentStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

function feedbackPath(membershipId: string, key: "error" | "created", message: string) {
  return `/settings/access?member=${encodeURIComponent(membershipId)}&${key}=${encodeURIComponent(message)}`;
}

export async function updateMembershipAccess(formData: FormData) {
  const current = await getCurrentStaff();
  if (current.role !== "admin") redirect(routeMessage("/dashboard", "error", "Only administrators can manage roles and permissions."));

  const membershipId = formText(formData, "membershipId");
  const role = formText(formData, "role");
  const status = formText(formData, "status");
  const branchIds = formData.getAll("branchId").map(String).filter(Boolean);
  const permissionCodes = formData.getAll("permissionCode").map(String).filter(Boolean);

  if (!membershipId || !["admin", "staff"].includes(role) || !["active", "suspended"].includes(status)) {
    redirect(feedbackPath(membershipId, "error", "Choose a valid role and account status."));
  }
  if (role === "staff" && branchIds.length === 0) {
    redirect(feedbackPath(membershipId, "error", "Assign Staff to at least one branch."));
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("update_membership_access", {
      p_membership_id: membershipId,
      p_role: role as "admin" | "staff",
      p_status: status,
      p_branch_ids: role === "admin" ? [] : branchIds,
      p_permission_codes: role === "admin" ? [] : permissionCodes,
    });
    if (error) throw error;
  } catch (error) {
    redirect(feedbackPath(membershipId, "error", operationError(error, "The access assignment could not be updated.")));
  }

  revalidatePath("/settings/access");
  revalidatePath("/staff");
  revalidatePath("/", "layout");
  redirect(feedbackPath(membershipId, "created", "Access assignment updated."));
}
