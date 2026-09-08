"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formText, optionalText, routeMessage, operationError } from "@/lib/actions/form";
import { normalizeMobile } from "@/lib/auth/mobile";
import { getCurrentStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function manageStaff(_state: { error: string }, form: FormData) {
  const staff = await getCurrentStaff();
  if (staff.role !== "admin") return { error: "Only administrators can manage staff." };
  const action = formText(form, "staffAction");
  const membershipId = formText(form, "membershipId");
  if (!membershipId || !["edit", "delete"].includes(action)) return { error: "Invalid staff action." };
  if (action === "delete" && form.get("confirmDelete") !== "on") return { error: "Confirm staff deletion first." };
  const details = {
    displayName: formText(form, "displayName"), role: formText(form, "role"), status: formText(form, "status"),
    branchIds: form.getAll("branchId").map(String), permissionCodes: form.getAll("permissionCode").map(String).filter(code => code !== "hv_permit.authorize"),
    isTechnician: form.get("isTechnician") === "on", employeeNo: formText(form, "employeeNo"), laborGrade: formText(form, "laborGrade"),
  };
  if (action === "edit" && (!details.displayName || details.displayName.length > 160 || details.employeeNo.length > 80 || details.laborGrade.length > 80 || !["admin", "staff"].includes(details.role) || !["active", "suspended"].includes(details.status))) return { error: "Enter valid staff details." };
  if (action === "edit" && details.role === "staff" && !details.branchIds.length) return { error: "Assign Staff to at least one branch." };
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("manage_staff", { p_organization_id: staff.organizationId, p_membership_id: membershipId, p_action: action, p_details: action === "edit" ? details : {} });
    if (error) return { error: operationError(error, "Staff changes could not be saved.") };
  } catch (error) { return { error: operationError(error, "Staff changes could not be saved.") }; }
  revalidatePath("/staff"); revalidatePath("/settings/access"); revalidatePath("/", "layout");
  redirect(routeMessage("/staff", "created", action === "delete" ? "Staff access deleted. Historical records are retained." : "Staff updated."));
}

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
