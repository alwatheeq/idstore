"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formText, operationError, optionalText, routeMessage } from "@/lib/actions/form";
import { getCurrentStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const contactNumberPattern = /^[+0-9][+0-9 ()-]{6,23}$/;

export async function createBranch(formData: FormData) {
  const staff = await getCurrentStaff();
  if (staff.role !== "admin") redirect(routeMessage("/branches", "error", "Only administrators can create branches."));

  const code = formText(formData, "code").toUpperCase();
  const legalName = formText(formData, "legalName");
  const displayName = formText(formData, "displayName");
  const city = formText(formData, "city");
  const addressLine1 = formText(formData, "addressLine1");
  const phone = formText(formData, "phone");
  const whatsapp = formText(formData, "whatsapp");

  if (!/^[A-Z0-9][A-Z0-9-]{1,15}$/.test(code) || !legalName || !displayName || !city) {
    redirect(routeMessage("/branches", "error", "Enter a valid code, legal name, display name and city."));
  }
  if (!addressLine1 || !contactNumberPattern.test(phone) || !contactNumberPattern.test(whatsapp)) {
    redirect(routeMessage("/branches", "error", "Address, phone and WhatsApp number are required for every branch."));
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("create_branch", {
      p_organization_id: staff.organizationId,
      p_code: code,
      p_legal_name: legalName,
      p_display_name: displayName,
      p_city: city,
      p_address_line1: addressLine1,
      p_phone: phone,
      p_whatsapp: whatsapp,
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

export async function updateBranchContacts(formData: FormData) {
  const staff = await getCurrentStaff();
  const branchId = formText(formData, "branchId");
  const addressLine1 = formText(formData, "addressLine1");
  const phone = formText(formData, "phone");
  const whatsapp = formText(formData, "whatsapp");
  const email = optionalText(formData, "email");
  const feedbackPath = (key: "error" | "created", message: string) =>
    `/branches?edit=${encodeURIComponent(branchId)}&${key}=${encodeURIComponent(message)}#branch-contacts`;

  if (staff.role !== "admin") redirect(routeMessage("/branches", "error", "Only administrators can update branch contacts."));
  if (!branchId || !addressLine1 || !contactNumberPattern.test(phone) || !contactNumberPattern.test(whatsapp)) {
    redirect(feedbackPath("error", "Address, phone and WhatsApp number are required for every branch."));
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("update_branch_contacts", {
      p_branch_id: branchId,
      p_address_line1: addressLine1,
      p_phone: phone,
      p_whatsapp: whatsapp,
      p_email: email ?? null,
    });
    if (error) throw error;
  } catch (error) {
    redirect(feedbackPath("error", operationError(error, "The branch contacts could not be updated.")));
  }

  revalidatePath("/branches");
  revalidatePath("/", "layout");
  redirect(feedbackPath("created", "Branch contacts updated."));
}
