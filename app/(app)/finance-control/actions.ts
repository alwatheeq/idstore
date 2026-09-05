"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formText, operationError, routeMessage } from "@/lib/actions/form";
import { getCurrentStaff, resolveOperatingBranch } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

function amount(formData: FormData, key: string) { const value = Number(formText(formData, key)); return Number.isFinite(value) ? value : NaN; }
function done(message: string): never { revalidatePath("/finance-control"); revalidatePath("/invoices"); revalidatePath("/reports"); redirect(routeMessage("/finance-control", "created", message)); }
function failed(error: unknown, fallback: string): never { redirect(routeMessage("/finance-control", "error", operationError(error, fallback))); }

export async function postCreditNote(formData: FormData) {
  await getCurrentStaff(); const invoiceId=formText(formData,"invoiceId"); const invoiceLineId=formText(formData,"invoiceLineId"); const quantity=amount(formData,"quantity"); const reason=formText(formData,"reason");
  if(!invoiceId||!invoiceLineId||!reason||quantity<=0) redirect(routeMessage("/finance-control","error","Invoice line, positive quantity and reason are required."));
  try { const supabase=await createClient(); const { error }=await supabase.rpc("post_credit_note",{p_invoice_id:invoiceId,p_reason:reason,p_lines:[{invoice_line_id:invoiceLineId,quantity}]}); if(error) throw error; } catch(error){failed(error,"The credit note could not be posted.");}
  done("Credit note posted and queued for the fiscal adapter.");
}

export async function recordRefund(formData: FormData) {
  await getCurrentStaff(); const paymentId=formText(formData,"paymentId"); const creditNoteId=formText(formData,"creditNoteId"); const value=amount(formData,"amount"); const reason=formText(formData,"reason"); const key=formText(formData,"idempotencyKey");
  if(!paymentId||!creditNoteId||!reason||!key||value<=0) redirect(routeMessage("/finance-control","error","Payment, credit note, positive amount, reason and reference are required."));
  try { const supabase=await createClient(); const { error }=await supabase.rpc("record_payment_refund",{p_payment_id:paymentId,p_credit_note_id:creditNoteId,p_amount:value,p_reason:reason,p_provider_ref:formText(formData,"providerRef"),p_idempotency_key:key}); if(error) throw error; } catch(error){failed(error,"The refund could not be recorded.");}
  done("Refund recorded against its payment and credit note.");
}

export async function openCashSession(formData: FormData) {
  const staff=await getCurrentStaff(); const branchId=resolveOperatingBranch(staff, formText(formData,"branchId")); const registerCode=formText(formData,"registerCode"); const openingFloat=amount(formData,"openingFloat");
  if(!branchId||!registerCode||openingFloat<0) redirect(routeMessage("/finance-control","error","Branch, register and a non-negative opening float are required."));
  try { const supabase=await createClient(); const { error }=await supabase.rpc("open_cash_session",{p_branch_id:branchId,p_register_code:registerCode,p_opening_float:openingFloat}); if(error) throw error; } catch(error){failed(error,"The cash session could not be opened.");}
  done("Cash session opened.");
}

export async function closeCashSession(formData: FormData) {
  await getCurrentStaff(); const sessionId=formText(formData,"sessionId"); const counted=amount(formData,"countedClose");
  if(!sessionId||counted<0) redirect(routeMessage("/finance-control","error","Session and non-negative counted cash are required."));
  try { const supabase=await createClient(); const { error }=await supabase.rpc("close_cash_session",{p_session_id:sessionId,p_counted_close:counted}); if(error) throw error; } catch(error){failed(error,"The cash session could not be closed.");}
  done("Cash session closed and variance calculated.");
}

export async function approveCashSession(formData: FormData) {
  await getCurrentStaff(); const sessionId=formText(formData,"sessionId"); if(!sessionId) redirect(routeMessage("/finance-control","error","Cash session is required."));
  try { const supabase=await createClient(); const { error }=await supabase.rpc("approve_cash_session",{p_session_id:sessionId}); if(error) throw error; } catch(error){failed(error,"The cash session could not be approved.");}
  done("Cash variance approved.");
}
