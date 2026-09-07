"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formText, optionalText, routeMessage } from "@/lib/actions/form";
import { normalizeMobile } from "@/lib/auth/mobile";
import { getCurrentStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

async function functionMessage(error: unknown) {
  if (!error || typeof error !== "object" || !("context" in error)) return null;
  const context = (error as { context?: unknown }).context;
  if (!(context instanceof Response)) return null;
  try {
    const payload = await context.clone().json() as { error?: unknown };
    return typeof payload.error === "string" ? payload.error : null;
  } catch {
    return null;
  }
}

export async function provisionStaff(formData: FormData) {
  const staff = await getCurrentStaff();
  if (staff.role !== "admin") redirect(routeMessage("/staff", "error", "Only administrators can add staff accounts."));

  const displayName = formText(formData, "displayName");
  const pin = formText(formData, "pin");
  const role = formText(formData, "role");
  const branchIds = formData.getAll("branchId").map(String).filter(Boolean);
  const permissionCodes = formData.getAll("permissionCode").map(String).filter(code => code && code !== "hv_permit.authorize");
  if (!displayName || !/^\d{6}$/.test(pin) || !["admin", "staff"].includes(role)) {
    redirect(routeMessage("/staff", "error", "Name, role and a six-digit PIN are required."));
  }
  if (role === "staff" && branchIds.length === 0) {
    redirect(routeMessage("/staff", "error", "Assign Staff to at least one branch."));
  }

  let mobile: string;
  try {
    mobile = normalizeMobile(formText(formData, "dialCode"), formText(formData, "mobile"));
  } catch (error) {
    redirect(routeMessage("/staff", "error", error instanceof Error ? error.message : "Enter a valid mobile number."));
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.functions.invoke("provision-staff", {
      body: {
        organizationId: staff.organizationId,
        displayName,
        mobile,
        pin,
        role,
        branchIds,
        permissionCodes,
        isTechnician: formData.get("isTechnician") === "on",
        employeeNo: optionalText(formData, "employeeNo") ?? "",
        laborGrade: optionalText(formData, "laborGrade") ?? "",
      },
    });
    if (error) throw error;
  } catch (error) {
    const message = await functionMessage(error);
    redirect(routeMessage("/staff", "error", message ?? "The staff account could not be created."));
  }

  revalidatePath("/staff");
  redirect(routeMessage("/staff", "created", "Staff account created."));
}
