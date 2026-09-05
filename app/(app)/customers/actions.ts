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

async function functionMessage(error: unknown) {
  if (!error || typeof error !== "object" || !("context" in error)) return null;
  const context = (error as { context?: unknown }).context;
  if (!(context instanceof Response)) return null;
  try { const payload = await context.clone().json() as { error?: unknown }; return typeof payload.error === "string" ? payload.error : null; } catch { return null; }
}

export async function provisionCustomerPortal(formData: FormData) {
  const staff = await getCurrentStaff();
  if (staff.role !== "admin") redirect(routeMessage("/customers", "error", "Only administrators can create customer portal access."));
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
  await getCurrentStaff(); const customerId=formText(formData,"customerId"),kind=formText(formData,"kind"),value=formText(formData,"value");
  if(!customerId||!value||!["mobile","phone","email","whatsapp"].includes(kind)) redirect(routeMessage("/customers","error","Customer, contact type and value are required."));
  let normalized=value.trim().toLowerCase();
  try { if(kind!=="email") normalized=normalizeMobile(formText(formData,"dialCode"),value); else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error("Enter a valid email address."); }
  catch(error){redirect(routeMessage("/customers","error",error instanceof Error?error.message:"Enter a valid contact."));}
  try{const supabase=await createClient();const {error}=await supabase.rpc("add_customer_contact",{p_customer_id:customerId,p_kind:kind,p_value:kind==="email"?value.trim():normalized,p_normalized_value:normalized,p_is_primary:formData.get("isPrimary")==="on"});if(error)throw error;}catch(error){redirect(routeMessage("/customers","error",operationError(error,"The contact could not be added.")));}
  revalidatePath("/customers");redirect(routeMessage("/customers","created","Customer contact added."));
}

export async function recordCustomerConsent(formData: FormData) {
  await getCurrentStaff();const customerId=formText(formData,"customerId"),purpose=formText(formData,"purpose"),channel=formText(formData,"channel"),state=formText(formData,"state"),policyVersion=formText(formData,"policyVersion"),source=formText(formData,"source");
  if(!customerId||!purpose||!policyVersion||!source||!["email","sms","whatsapp","push","phone"].includes(channel)||!["granted","withdrawn"].includes(state))redirect(routeMessage("/customers","error","Complete the consent purpose, channel, state, policy version and evidence source."));
  try{const supabase=await createClient();const {error}=await supabase.rpc("record_customer_consent",{p_customer_id:customerId,p_purpose:purpose,p_channel:channel,p_state:state,p_policy_version:policyVersion,p_source:source});if(error)throw error;}catch(error){redirect(routeMessage("/customers","error",operationError(error,"Consent evidence could not be recorded.")));}
  revalidatePath("/customers");redirect(routeMessage("/customers","created","Consent evidence recorded."));
}
