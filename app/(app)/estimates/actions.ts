"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formText, operationError, optionalNumber, optionalText } from "@/lib/actions/form";
import { getCurrentStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

function estimateRoute(estimateId: string | undefined, key: "created" | "error", message: string) {
  const params = new URLSearchParams({ [key]: message });
  if (estimateId) params.set("estimate", estimateId);
  return `/estimates?${params.toString()}${estimateId ? "#estimate-workspace" : ""}`;
}

export async function createEstimate(formData: FormData) {
  await getCurrentStaff();
  const repairOrderId = formText(formData, "repairOrderId");
  if (!repairOrderId) redirect(estimateRoute(undefined, "error", "Choose a repair order to estimate."));
  let createdId: string;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_estimate_from_repair_order", { p_repair_order_id: repairOrderId });
    if (error || !data) throw error ?? new Error("Estimate was not created.");
    createdId = data.id;
  } catch (error) {
    redirect(estimateRoute(undefined, "error", operationError(error, "The estimate could not be created.")));
  }
  revalidatePath("/estimates");
  redirect(estimateRoute(createdId, "created", "Draft estimate created."));
}

export async function addEstimateLine(formData: FormData) {
  await getCurrentStaff();
  const estimateId = formText(formData, "estimateId");
  const lineType = formText(formData, "lineType");
  const description = formText(formData, "description");
  const quantity = optionalNumber(formData, "quantity");
  const unitPrice = optionalNumber(formData, "unitPrice");
  const discountAmount = optionalNumber(formData, "discountAmount");
  const taxRate = optionalNumber(formData, "taxRate");
  if (!estimateId || !description || !["labor", "part", "fee", "warranty", "goodwill", "text"].includes(lineType)
      || [quantity, unitPrice, discountAmount, taxRate].some((value) => value === undefined || Number.isNaN(value))) {
    redirect(estimateRoute(estimateId || undefined, "error", "Complete all estimate line values."));
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("add_estimate_line", {
      p_estimate_id: estimateId, p_line_type: lineType, p_description: description,
      p_quantity: quantity!, p_unit_price: unitPrice!, p_discount_amount: discountAmount!, p_tax_rate: taxRate!,
      p_approval_group: optionalText(formData, "approvalGroup") ?? "General",
      p_finding_id: optionalText(formData, "findingId") ?? null,
    });
    if (error) throw error;
  } catch (error) {
    redirect(estimateRoute(estimateId, "error", operationError(error, "The estimate line could not be added.")));
  }
  revalidatePath("/estimates"); revalidatePath("/inspections");
  redirect(estimateRoute(estimateId, "created", "Estimate line added."));
}

export async function removeEstimateLine(formData: FormData) {
  await getCurrentStaff();
  const estimateId = formText(formData, "estimateId");
  const lineId = formText(formData, "lineId");
  if (!estimateId || !lineId) redirect(estimateRoute(estimateId || undefined, "error", "Estimate line is invalid."));
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("remove_estimate_line", { p_estimate_line_id: lineId });
    if (error) throw error;
  } catch (error) {
    redirect(estimateRoute(estimateId, "error", operationError(error, "The estimate line could not be removed.")));
  }
  revalidatePath("/estimates"); revalidatePath("/inspections");
  redirect(estimateRoute(estimateId, "created", "Estimate line removed."));
}

export async function sendEstimate(formData: FormData) {
  await getCurrentStaff();
  const estimateId = formText(formData, "estimateId");
  const validDays = Number(formText(formData, "validDays"));
  if (!estimateId || !Number.isSafeInteger(validDays)) redirect(estimateRoute(estimateId || undefined, "error", "Choose a valid estimate period."));
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("send_estimate", { p_estimate_id: estimateId, p_valid_days: validDays });
    if (error) throw error;
  } catch (error) {
    redirect(estimateRoute(estimateId, "error", operationError(error, "The estimate could not be sent.")));
  }
  revalidatePath("/estimates"); revalidatePath("/work-orders"); revalidatePath("/dashboard");
  redirect(estimateRoute(estimateId, "created", "Estimate sent and locked for customer decision."));
}

export async function recordEstimateDecision(formData: FormData) {
  await getCurrentStaff();
  const estimateId = formText(formData, "estimateId");
  const decision = formText(formData, "decision");
  const actorName = formText(formData, "actorName");
  const channel = formText(formData, "channel");
  if (!estimateId || !actorName || !["approved", "declined"].includes(decision) || !["phone", "whatsapp", "email", "in_person", "portal"].includes(channel)) {
    redirect(estimateRoute(estimateId || undefined, "error", "Customer, decision and evidence channel are required."));
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("record_estimate_decision", {
      p_estimate_id: estimateId, p_decision: decision, p_actor_name: actorName, p_channel: channel,
      p_evidence_note: optionalText(formData, "evidenceNote") ?? "",
    });
    if (error) throw error;
  } catch (error) {
    redirect(estimateRoute(estimateId, "error", operationError(error, "The customer decision could not be recorded.")));
  }
  revalidatePath("/estimates"); revalidatePath("/inspections"); revalidatePath("/work-orders"); revalidatePath("/dashboard");
  redirect(estimateRoute(estimateId, "created", `Estimate ${decision}.`));
}

export async function recordEstimateGroupDecision(formData: FormData) {
  await getCurrentStaff();
  const estimateId = formText(formData, "estimateId");
  const approvalGroup = formText(formData, "approvalGroup");
  const decision = formText(formData, "decision");
  const actorName = formText(formData, "actorName");
  const channel = formText(formData, "channel");
  if (!estimateId || !approvalGroup || !actorName || !["approved", "declined"].includes(decision) || !["phone", "whatsapp", "email", "in_person", "portal"].includes(channel)) {
    redirect(estimateRoute(estimateId || undefined, "error", "Approval group, customer, decision and evidence channel are required."));
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("record_estimate_group_decision", { p_estimate_id: estimateId, p_approval_group: approvalGroup, p_decision: decision, p_actor_name: actorName, p_channel: channel, p_evidence_note: optionalText(formData, "evidenceNote") ?? "" });
    if (error) throw error;
  } catch (error) {
    redirect(estimateRoute(estimateId, "error", operationError(error, "The group decision could not be recorded.")));
  }
  revalidatePath("/estimates"); revalidatePath("/work-orders"); revalidatePath("/dashboard");
  redirect(estimateRoute(estimateId, "created", `${approvalGroup} decision recorded.`));
}

export async function createSupplementaryEstimate(formData: FormData) {
  await getCurrentStaff();
  const estimateId = formText(formData, "estimateId");
  const reason = formText(formData, "reason");
  if (!estimateId || !reason) redirect(estimateRoute(estimateId || undefined, "error", "Source estimate and supplement reason are required."));
  let createdId: string;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_supplementary_estimate", { p_estimate_id: estimateId, p_reason: reason });
    if (error || !data) throw error ?? new Error("Supplement was not created.");
    createdId = data.id;
  } catch (error) {
    redirect(estimateRoute(estimateId, "error", operationError(error, "The supplementary estimate could not be created.")));
  }
  revalidatePath("/estimates");
  redirect(estimateRoute(createdId, "created", "Supplementary estimate created."));
}

export async function approvePriceOverride(formData: FormData) {
  const staff = await getCurrentStaff();
  const estimateId = formText(formData, "estimateId");
  const lineId = formText(formData, "lineId");
  const catalogPrice = optionalNumber(formData, "catalogPrice");
  const overridePrice = optionalNumber(formData, "overridePrice");
  const reason = formText(formData, "reason");
  if (staff.role !== "admin" || !estimateId || !lineId || catalogPrice === undefined || overridePrice === undefined || Number.isNaN(catalogPrice) || Number.isNaN(overridePrice) || !reason) {
    redirect(estimateRoute(estimateId || undefined, "error", "Administrator, catalog price, override price and reason are required."));
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("approve_estimate_price_override", { p_estimate_line_id: lineId, p_catalog_unit_price: catalogPrice, p_override_unit_price: overridePrice, p_reason: reason });
    if (error) throw error;
  } catch (error) {
    redirect(estimateRoute(estimateId, "error", operationError(error, "The price override could not be approved.")));
  }
  revalidatePath("/estimates");
  redirect(estimateRoute(estimateId, "created", "Price override approved and audited."));
}
