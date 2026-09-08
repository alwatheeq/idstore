"use server";

import { submissionKey } from "@/lib/actions/submission-key";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formText, operationError, optionalNumber, optionalText, routeMessage } from "@/lib/actions/form";
import { getCurrentStaff, resolveOperatingBranch } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const path = "/stock-control";
const done = (message: string) => { revalidatePath(path); revalidatePath("/inventory"); redirect(routeMessage(path, "created", message)); };
const fail = (error: unknown, fallback: string) => redirect(routeMessage(path, "error", operationError(error, fallback)));

export async function createStockTransfer(formData: FormData) {
  const staff = await getCurrentStaff();
  const source = resolveOperatingBranch(staff, formText(formData, "sourceBranchId")); const destination = formText(formData, "destinationBranchId");
  if (!source || !destination || source === destination) redirect(routeMessage(path, "error", "Choose two different branches."));
  try { const supabase = await createClient(); const { error } = await supabase.rpc("create_stock_transfer", { p_source_branch_id: source, p_destination_branch_id: destination }); if (error) throw error; }
  catch (error) { fail(error, "The stock transfer could not be created."); }
  done("Draft stock transfer created.");
}

export async function addStockTransferLine(formData: FormData) {
  await getCurrentStaff();
  const transferId = formText(formData, "transferId"); const partId = formText(formData, "partId");
  const sourceBinId = formText(formData, "sourceBinId"); const destinationBinId = formText(formData, "destinationBinId");
  const quantity = optionalNumber(formData, "quantity");
  if (!transferId || !partId || !sourceBinId || !destinationBinId || quantity === undefined || !Number.isFinite(quantity) || quantity <= 0) redirect(routeMessage(path, "error", "Transfer, part, route and positive quantity are required."));
  try { const supabase = await createClient(); const { error } = await supabase.rpc("add_stock_transfer_line", { p_transfer_id: transferId, p_part_id: partId, p_lot_id: optionalText(formData, "lotId") ?? null, p_source_bin_id: sourceBinId, p_destination_bin_id: destinationBinId, p_quantity: quantity }); if (error) throw error; }
  catch (error) { fail(error, "The transfer line could not be added."); }
  done("Stock reserved for transfer.");
}

export async function transitionStockTransfer(formData: FormData) {
  await getCurrentStaff(); const transferId = formText(formData, "transferId"); const status = formText(formData, "status");
  if (!transferId || !["requested", "approved", "dispatched", "cancelled"].includes(status)) redirect(routeMessage(path, "error", "Transfer action is invalid."));
  try { const supabase = await createClient(); const { error } = await supabase.rpc("transition_stock_transfer", { p_transfer_id: transferId, p_to_status: status }); if (error) throw error; }
  catch (error) { fail(error, "The transfer could not be progressed."); }
  done(`Transfer marked ${status}.`);
}

export async function receiveStockTransferLine(formData: FormData) {
  await getCurrentStaff(); const lineId = formText(formData, "lineId"); const quantity = optionalNumber(formData, "quantity");
  if (!lineId || quantity === undefined || !Number.isFinite(quantity) || quantity < 0) redirect(routeMessage(path, "error", "Enter a valid received quantity."));
  try { const supabase = await createClient(); const { error } = await supabase.rpc("receive_stock_transfer_line", { p_line_id: lineId, p_quantity: quantity, p_close_line: formData.get("closeLine") === "on", p_discrepancy_reason: optionalText(formData, "discrepancyReason") ?? "", p_idempotency_key: submissionKey(formData) }); if (error) throw error; }
  catch (error) { fail(error, "The transfer receipt could not be posted."); }
  done("Transfer receipt posted.");
}

export async function createStockCount(formData: FormData) {
  await getCurrentStaff(); const binId = formText(formData, "binId");
  if (!binId) redirect(routeMessage(path, "error", "Choose a bin to count."));
  try { const supabase = await createClient(); const { error } = await supabase.rpc("create_stock_count", { p_bin_id: binId }); if (error) throw error; }
  catch (error) { fail(error, "The stock count could not be opened."); }
  done("Blind stock count opened.");
}

export async function recordStockCountLine(formData: FormData) {
  await getCurrentStaff(); const lineId = formText(formData, "lineId"); const quantity = optionalNumber(formData, "quantity");
  if (!lineId || quantity === undefined || !Number.isFinite(quantity) || quantity < 0) redirect(routeMessage(path, "error", "Enter a non-negative counted quantity."));
  try { const supabase = await createClient(); const { error } = await supabase.rpc("record_stock_count_line", { p_count_line_id: lineId, p_counted_quantity: quantity }); if (error) throw error; }
  catch (error) { fail(error, "The count line could not be recorded."); }
  done("Counted quantity recorded.");
}

export async function postStockCount(formData: FormData) {
  await getCurrentStaff(); const countId = formText(formData, "countId");
  if (!countId) redirect(routeMessage(path, "error", "Stock count is invalid."));
  try { const supabase = await createClient(); const { error } = await supabase.rpc("post_stock_count", { p_count_id: countId }); if (error) throw error; }
  catch (error) { fail(error, "The stock count could not be posted."); }
  done("Stock count posted to the immutable movement ledger.");
}
