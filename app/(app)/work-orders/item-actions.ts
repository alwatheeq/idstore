"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formText, operationError } from "@/lib/actions/form";
import { isMaintenanceTask, maintenanceItemValues } from "@/lib/maintenance-order";

async function orderContext(orderId: string) {
  const staff = await getCurrentStaff();
  const supabase = await createClient();
  const { data: order, error } = await supabase.from("repair_orders").select("id, branch_id, status, order_type")
    .eq("organization_id", staff.organizationId).eq("id", orderId).single();
  if (error || !order) throw { code: "P0002" };
  if (staff.selectedBranchId && order.branch_id !== staff.selectedBranchId) throw { code: "42501" };
  if (["delivered", "closed", "cancelled"].includes(order.status)) throw { code: "23514", message: "This order is read-only." };
  return { staff, supabase, order };
}

export async function prepareOrderItems(form: FormData) {
  const orderId = formText(form, "repairOrderId");
  let errorMessage = "";
  try {
    const { supabase } = await orderContext(orderId);
    const { error } = await supabase.rpc("create_estimate_from_repair_order", { p_repair_order_id: orderId });
    if (error) throw error;
  } catch (error) { errorMessage = operationError(error, "The order items could not be opened."); }
  revalidatePath("/work-orders");
  redirect(`/work-orders?order=${encodeURIComponent(orderId)}${errorMessage ? `&error=${encodeURIComponent(errorMessage)}` : ""}#order-items`);
}

export async function addOrderItem(_state: { error: string }, form: FormData) {
  const values = maintenanceItemValues(form);
  if (!values) return { error: "Choose an item and enter a valid quantity, price and tax rate." };
  try {
    const { supabase, staff, order } = await orderContext(formText(form, "repairOrderId"));
    const invoiceId = formText(form, "invoiceId");
    const version = Number(formText(form, "version"));
    if (invoiceId && (!formText(form, "version") || !Number.isSafeInteger(version) || version < 1)) return { error: "This record changed. Refresh the page and try again." };
    const { data: estimate, error: estimateError } = await supabase.from(invoiceId ? "invoices" : "estimate_versions").select("id, status")
      .eq("organization_id", staff.organizationId).eq("repair_order_id", formText(form, "repairOrderId"))
      .eq("id", invoiceId || formText(form, "estimateId")).single();
    if (estimateError || !estimate || estimate.status !== "draft") return { error: "Only a draft order price list can be changed." };

    if (values.type === "part") {
      const { data, error } = await supabase.from("parts").select("part_number, description_en, description_ar")
        .eq("organization_id", staff.organizationId).eq("id", values.catalogId).eq("status", "active").single();
      if (error || !data) return { error: "This catalog item is no longer available." };

    } else {
      const recommendation = await supabase.from("work_order_service_choices").select("id, description_en, description_ar")
        .eq("organization_id", staff.organizationId).eq("repair_order_id", order.id).eq("service_version_id", values.catalogId).limit(1);
      if (recommendation.error || !recommendation.data?.length) return { error: "Select this service from a completed inspection first." };
      const { data, error } = await supabase.from("service_template_versions")
        .select("effective_from, effective_to, template:service_templates(name_en, name_ar, work_order_type), service_template_tasks(result_schema)")
        .eq("organization_id", staff.organizationId).eq("id", values.catalogId).in("status", ["published", "retired"]).single();
      // A catalog edit retires its old version; previously selected services retain their snapshot.
      if (error || !data?.template || (data.template.work_order_type ?? "maintenance") !== (order.order_type ?? "maintenance")
          || data.service_template_tasks.some(task => !isMaintenanceTask(task.result_schema))) return { error: "This catalog item is no longer available." };

    }
    const { error } = await supabase.rpc("add_order_catalog_item", {
      p_order_id: order.id, p_ledger_id: estimate.id, p_invoice_version: invoiceId ? version : null,
      p_item_type: values.type, p_catalog_id: values.catalogId,
      p_quantity: values.quantity, p_price: values.price, p_tax: values.tax,
    });
    if (error) throw error;
    revalidatePath("/work-orders");
    revalidatePath("/estimates");
    revalidatePath("/invoices");
    return { error: "" };
  } catch (error) { return { error: operationError(error, "The order item could not be saved. Please try again.") }; }
}

export async function removeOrderItem(form: FormData) {
  const orderId = formText(form, "repairOrderId");
  let errorMessage = "";
  try {
    const { supabase, staff } = await orderContext(orderId);
    if (formText(form, "ledger") === "invoice") {
      const version = Number(formText(form, "version"));
      if (!formText(form, "version") || !Number.isSafeInteger(version) || version < 1) throw { code: "40001" };
      const { data: line, error } = await supabase.from("invoice_lines")
        .select("id, invoice:invoices(repair_order_id, status)")
        .eq("organization_id", staff.organizationId).eq("id", formText(form, "lineId")).single();
      if (error || !line || line.invoice?.repair_order_id !== orderId || line.invoice.status !== "draft") throw { code: "42501" };
      const result = await supabase.rpc("remove_invoice_line", { p_invoice_line_id: line.id, p_expected_version: version });
      if (result.error) throw result.error;
    } else {
    const { data: line, error } = await supabase.from("estimate_lines")
      .select("id, estimate:estimate_versions(repair_order_id, status)")
      .eq("organization_id", staff.organizationId).eq("id", formText(form, "lineId")).single();
    if (error || !line || line.estimate?.repair_order_id !== orderId || line.estimate.status !== "draft") throw { code: "42501" };
    const result = await supabase.rpc("remove_estimate_line", { p_estimate_line_id: line.id });
    if (result.error) throw result.error;
    }
  } catch (error) { errorMessage = operationError(error, "The order item could not be removed."); }
  revalidatePath("/work-orders");
  revalidatePath("/estimates");
  revalidatePath("/invoices");
  redirect(`/work-orders?order=${encodeURIComponent(orderId)}${errorMessage ? `&error=${encodeURIComponent(errorMessage)}` : ""}#order-items`);
}

export async function materializeApprovedEstimate(form: FormData) {
  await getCurrentStaff();
  const orderId = formText(form, "repairOrderId");
  const target = formText(form, "target");
  let result: string | null = null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("materialize_approved_estimate", { p_estimate_id: formText(form, "estimateId"), p_target: target });
    if (error) throw error;
    result = data;
  } catch (error) { redirect(`/work-orders?order=${encodeURIComponent(orderId)}&error=${encodeURIComponent(operationError(error, "Approved work could not be prepared."))}`); }
  revalidatePath("/work-orders"); revalidatePath("/invoices");
  redirect(target === "invoice" ? `/invoices?line=${encodeURIComponent(result!)}#add-line` : `/work-orders?order=${encodeURIComponent(result!)}&view=advanced`);
}
