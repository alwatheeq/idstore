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
  const portalPin = formText(formData, "portalPin");

  if (!branchId || !displayName || !["individual", "company"].includes(customerType)) {
    redirect(routeMessage("/customers", "error", "Branch, customer type and name are required."));
  }
  if (portalPin && !/^\d{6}$/.test(portalPin)) {
    redirect(routeMessage("/customers", "error", "The portal PIN must be exactly six digits."));
  }
  if (portalPin && !rawMobile) {
    redirect(routeMessage("/customers", "error", "Mobile number is required when a portal PIN is provided."));
  }

  let mobile: string | undefined;
  try {
    mobile = rawMobile ? normalizeMobile(formText(formData, "dialCode"), rawMobile) : undefined;
  } catch (error) {
    redirect(routeMessage("/customers", "error", error instanceof Error ? error.message : "Enter a valid mobile number."));
  }

  let duplicateFound = false;
  if (mobile || optionalText(formData, "taxNumber")) {
    try {
      const supabase = await createClient();
      const { data: duplicates, error: duplicateError } = await supabase.rpc("find_customer_duplicates", {
        p_organization_id: staff.organizationId,
        p_display_name: null,
        p_normalized_contact: mobile ?? null,
        p_tax_number: optionalText(formData, "taxNumber") ?? null,
      });
      if (duplicateError) throw duplicateError;
      duplicateFound = Boolean(duplicates?.length);
    } catch (error) {
      redirect(routeMessage("/customers", "error", operationError(error, "Customer identity could not be checked.")));
    }
  }
  if (duplicateFound) {
    redirect(routeMessage("/customers", "error", "A customer already uses this mobile or tax number. Open the duplicate review before creating another record."));
  }

  try {
    const supabase = await createClient();
    const { data: createdCustomer, error } = await supabase.rpc("create_customer", {
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
    const customerId = typeof createdCustomer === "object" && createdCustomer ? (createdCustomer as { id?: string }).id : null;
    if (!customerId) {
      redirect(routeMessage("/customers", "error", "The customer could not be created."));
    }
    if (portalPin) {
      try {
        const provisionError = (await supabase.functions.invoke("provision-customer", {
          body: { organizationId: staff.organizationId, customerId, mobile: mobile!, pin: portalPin },
        })).error;
        if (provisionError) throw provisionError;
      } catch (error) {
        const message = (await functionMessage(error)) ?? "The portal access could not be created.";
        revalidatePath("/customers");
        revalidatePath("/vehicles");
        redirect(routeMessage("/customers", "created", `Customer created. ${message}`));
      }
    }
  } catch (error) {
    redirect(routeMessage("/customers", "error", operationError(error, "The customer could not be created.")));
  }

  revalidatePath("/customers");
  revalidatePath("/vehicles");
  redirect(routeMessage("/customers", "created", "Customer created."));
}

async function functionMessage(error: unknown) {
  if (!error || typeof error !== "object" || !("context" in error)) return null;
  const context = (error as { context?: unknown }).context;
  if (!(context instanceof Response)) return null;
  try { const payload = await context.clone().json() as { error?: unknown }; return typeof payload.error === "string" ? payload.error : null; } catch { return null; }
}

export async function provisionCustomerPortal(formData: FormData) {
  const staff = await getCurrentStaff();
  if (staff.role !== "admin" && !staff.permissionCodes.includes("crm.manage")) {
    redirect(routeMessage("/customers", "error", "You do not have permission to create customer portal access."));
  }
  const customerId = formText(formData, "customerId"); const pin = formText(formData, "pin");
  if (!customerId || !/^\d{6}$/.test(pin)) redirect(routeMessage("/customers", "error", "Customer and a six-digit PIN are required."));
  let mobile: string;
  try { mobile = normalizeMobile(formText(formData, "dialCode"), formText(formData, "mobile")); }
  catch (error) { redirect(routeMessage("/customers", "error", error instanceof Error ? error.message : "Enter a valid mobile number.")); }
  try {
    const supabase = await createClient(); const { error } = await supabase.functions.invoke("provision-customer", { body: { organizationId: staff.organizationId, customerId, mobile, pin } }); if (error) throw error;
  } catch (error) { redirect(routeMessage("/customers", "error", (await functionMessage(error)) ?? "The portal account could not be created.")); }
  revalidatePath("/customers"); redirect(routeMessage("/customers", "created", "Customer portal access created."));
}

export async function addCustomerContact(formData: FormData) {
  const staff = await getCurrentStaff();
  const customerId = formText(formData, "customerId"), kind = formText(formData, "kind"), value = formText(formData, "value");
  if(!customerId||!value||!["mobile","phone","email","whatsapp"].includes(kind)) redirect(routeMessage("/customers","error","Customer, contact type and value are required."));
  let normalized=value.trim().toLowerCase();
  try { if(kind!=="email") normalized=normalizeMobile(formText(formData,"dialCode"),value); else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error("Enter a valid email address."); }
  catch(error){redirect(routeMessage("/customers","error",error instanceof Error?error.message:"Enter a valid contact."));}
  if (kind === "mobile") {
    try {
      const supabase = await createClient();
      const { data: duplicates, error: duplicateError } = await supabase.rpc("find_customer_duplicates", {
        p_organization_id: staff.organizationId,
        p_display_name: null,
        p_normalized_contact: normalized,
        p_tax_number: null,
      });
      if (duplicateError) throw duplicateError;
      if ((duplicates ?? []).some((entry: { customer_id: string }) => entry.customer_id !== customerId)) {
        redirect(routeMessage("/customers", "error", "This mobile number is already used by another customer."));
      }
    } catch (error) {
      redirect(routeMessage("/customers", "error", operationError(error, "Customer identity could not be checked.")));
    }
  }
  try{const supabase=await createClient();const {error}=await supabase.rpc("add_customer_contact",{p_customer_id:customerId,p_kind:kind,p_value:kind==="email"?value.trim():normalized,p_normalized_value:normalized,p_is_primary:formData.get("isPrimary")==="on"});if(error)throw error;}catch(error){redirect(routeMessage("/customers","error",operationError(error,"The contact could not be added.")));}
  revalidatePath("/customers");redirect(routeMessage("/customers","created","Customer contact added."));
}

export async function recordCustomerConsent(formData: FormData) {
  await getCurrentStaff();const customerId=formText(formData,"customerId"),purpose=formText(formData,"purpose"),channel=formText(formData,"channel"),state=formText(formData,"state"),policyVersion=formText(formData,"policyVersion"),source=formText(formData,"source");
  if(!customerId||!purpose||!policyVersion||!source||!["email","sms","whatsapp","push","phone"].includes(channel)||!["granted","withdrawn"].includes(state))redirect(routeMessage("/customers","error","Complete the consent purpose, channel, state, policy version and evidence source."));
  try{const supabase=await createClient();const {error}=await supabase.rpc("record_customer_consent",{p_customer_id:customerId,p_purpose:purpose,p_channel:channel,p_state:state,p_policy_version:policyVersion,p_source:source});if(error)throw error;}catch(error){redirect(routeMessage("/customers","error",operationError(error,"Consent evidence could not be recorded.")));}
  revalidatePath("/customers");redirect(routeMessage("/customers","created","Consent evidence recorded."));
}

export async function addCustomerAddress(formData: FormData) {
  await getCurrentStaff();
  const customerId = formText(formData, "customerId");
  const addressType = formText(formData, "addressType");
  const countryCode = formText(formData, "countryCode").toUpperCase();
  const city = formText(formData, "city");
  const addressLine1 = formText(formData, "addressLine1");
  if (!customerId || !["billing", "service", "home", "work"].includes(addressType) || !/^[A-Z]{2}$/.test(countryCode) || !city || !addressLine1) {
    redirect(routeMessage("/customers", "error", "Customer, address type, country, city and address line are required."));
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("add_customer_address", {
      p_customer_id: customerId,
      p_address_type: addressType,
      p_country_code: countryCode,
      p_admin_area: optionalText(formData, "adminArea") ?? "",
      p_city: city,
      p_address_line1: addressLine1,
      p_address_line2: optionalText(formData, "addressLine2") ?? "",
      p_postal_code: optionalText(formData, "postalCode") ?? "",
      p_is_primary: formData.get("isPrimary") === "on",
    });
    if (error) throw error;
  } catch (error) {
    redirect(routeMessage("/customers", "error", operationError(error, "The address could not be added.")));
  }
  revalidatePath("/customers");
  redirect(routeMessage("/customers", "created", "Customer address added."));
}

export async function transitionCustomerStatus(formData: FormData) {
  await getCurrentStaff();
  const customerId = formText(formData, "customerId");
  const status = formText(formData, "status");
  const reason = formText(formData, "reason");
  if (!customerId || !["active", "restricted", "archived"].includes(status) || !reason) {
    redirect(routeMessage("/customers", "error", "Customer, target status and an audit reason are required."));
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("transition_customer_status", {
      p_customer_id: customerId,
      p_to_status: status,
      p_reason: reason,
    });
    if (error) throw error;
  } catch (error) {
    redirect(routeMessage("/customers", "error", operationError(error, "The customer status could not be changed.")));
  }
  revalidatePath("/customers");
  revalidatePath("/appointments");
  revalidatePath("/work-orders");
  redirect(routeMessage("/customers", "created", `Customer marked ${status}.`));
}
