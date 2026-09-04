"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formText, operationError, optionalText, routeMessage } from "@/lib/actions/form";
import { getCurrentStaff } from "@/lib/auth/session";
import { normalizeMobile } from "@/lib/auth/mobile";
import { createClient } from "@/lib/supabase/server";

export async function createCustomer(formData: FormData) {
  const staff = await getCurrentStaff();
  const branchId = formText(formData, "branchId");
  const customerType = formText(formData, "customerType");
  const displayName = formText(formData, "displayName");
  const rawMobile = formText(formData, "mobile");

  if (!branchId || !displayName || !["individual", "company"].includes(customerType)) {
    redirect(routeMessage("/customers", "error", "Branch, customer type and name are required."));
  }

  let mobile: string | undefined;
  try {
    mobile = rawMobile ? normalizeMobile(formText(formData, "dialCode"), rawMobile) : undefined;
  } catch (error) {
    redirect(routeMessage("/customers", "error", error instanceof Error ? error.message : "Enter a valid mobile number."));
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("create_customer", {
      p_organization_id: staff.organizationId,
      p_preferred_branch_id: branchId,
      p_customer_type: customerType,
      p_display_name: displayName,
      p_mobile: mobile,
      p_email: optionalText(formData, "email"),
      p_city: optionalText(formData, "city"),
      p_address_line1: optionalText(formData, "addressLine1"),
      p_tax_number: optionalText(formData, "taxNumber"),
      p_notes: optionalText(formData, "notes"),
    });
    if (error) throw error;
  } catch (error) {
    redirect(routeMessage("/customers", "error", operationError(error, "The customer could not be created.")));
  }

  revalidatePath("/customers");
  revalidatePath("/vehicles");
  redirect(routeMessage("/customers", "created", "Customer created."));
}
