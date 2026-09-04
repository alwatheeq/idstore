"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formText, operationError, optionalText, routeMessage } from "@/lib/actions/form";
import { getCurrentStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function createBranch(formData: FormData) {
  const staff = await getCurrentStaff();
  if (staff.role !== "admin") redirect(routeMessage("/branches", "error", "Only administrators can create branches."));

  const code = formText(formData, "code").toUpperCase();
  const legalName = formText(formData, "legalName");
  const displayName = formText(formData, "displayName");
  const city = formText(formData, "city");

  if (!/^[A-Z0-9][A-Z0-9-]{1,15}$/.test(code) || !legalName || !displayName || !city) {
    redirect(routeMessage("/branches", "error", "Enter a valid code, legal name, display name and city."));
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("create_branch", {
      p_organization_id: staff.organizationId,
      p_code: code,
      p_legal_name: legalName,
      p_display_name: displayName,
      p_city: city,
      p_address_line1: optionalText(formData, "addressLine1"),
      p_phone: optionalText(formData, "phone"),
      p_email: optionalText(formData, "email"),
      p_tax_registration: optionalText(formData, "taxRegistration"),
      p_hv_capable: formData.get("hvCapable") === "on",
    });
    if (error) throw error;
  } catch (error) {
    redirect(routeMessage("/branches", "error", operationError(error, "The branch could not be created.")));
  }

  revalidatePath("/branches");
  revalidatePath("/", "layout");
  redirect(routeMessage("/branches", "created", "Branch created."));
}
