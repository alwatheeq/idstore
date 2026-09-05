"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formText, operationError, optionalNumber, optionalText, routeMessage } from "@/lib/actions/form";
import { getCurrentStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const purchasingPath = "/purchasing";

function commercialValues(formData: FormData) {
  const quantity = optionalNumber(formData, "quantity");
  const unitCost = optionalNumber(formData, "unitCost");
  const taxRate = optionalNumber(formData, "taxRate");
  if (quantity === undefined || !Number.isFinite(quantity) || quantity <= 0
      || unitCost === undefined || !Number.isFinite(unitCost) || unitCost < 0
      || taxRate === undefined || !Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) return null;
  return { quantity, unitCost, taxRate };
}

export async function createSupplier(formData: FormData) {
  const staff = await getCurrentStaff();
  const name = formText(formData, "name");
  if (!name) redirect(routeMessage(purchasingPath, "error", "Supplier name is required."));

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("create_supplier", {
      p_organization_id: staff.organizationId,
      p_name: name,
      p_tax_number: optionalText(formData, "taxNumber") ?? "",
      p_phone: optionalText(formData, "phone") ?? "",
      p_email: optionalText(formData, "email") ?? "",
    });
    if (error) throw error;
  } catch (error) {
    redirect(routeMessage(purchasingPath, "error", operationError(error, "The supplier could not be created.")));
  }

  revalidatePath(purchasingPath);
  redirect(routeMessage(purchasingPath, "created", "Supplier created."));
}

export async function createPurchaseOrder(formData: FormData) {
  const staff = await getCurrentStaff();
  const branchId = formText(formData, "branchId");
  const supplierId = formText(formData, "supplierId");
  const partId = formText(formData, "partId");
  const commercial = commercialValues(formData);
  if (!branchId || !supplierId || !partId || !commercial) {
    redirect(routeMessage(purchasingPath, "error", "Branch, supplier, part, quantity, unit cost and tax rate are required."));
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("create_purchase_order", {
      p_organization_id: staff.organizationId,
      p_branch_id: branchId,
      p_supplier_id: supplierId,
      p_part_id: partId,
      p_quantity: commercial.quantity,
      p_unit_cost: commercial.unitCost,
      p_tax_rate: commercial.taxRate,
    });
    if (error) throw error;
  } catch (error) {
    redirect(routeMessage(purchasingPath, "error", operationError(error, "The purchase order could not be created.")));
  }

  revalidatePath(purchasingPath);
  redirect(routeMessage(purchasingPath, "created", "Draft purchase order created."));
}

export async function addPurchaseOrderLine(formData: FormData) {
  await getCurrentStaff();
  const purchaseOrderId = formText(formData, "purchaseOrderId");
  const partId = formText(formData, "partId");
  const commercial = commercialValues(formData);
  if (!purchaseOrderId || !partId || !commercial) {
    redirect(routeMessage(purchasingPath, "error", "Purchase order, part and valid commercial values are required."));
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("add_purchase_order_line", {
      p_purchase_order_id: purchaseOrderId,
      p_part_id: partId,
      p_quantity: commercial.quantity,
      p_unit_cost: commercial.unitCost,
      p_tax_rate: commercial.taxRate,
    });
    if (error) throw error;
  } catch (error) {
    redirect(routeMessage(purchasingPath, "error", operationError(error, "The purchase-order line could not be added.")));
  }

  revalidatePath(purchasingPath);
  redirect(routeMessage(purchasingPath, "created", "Purchase-order line added."));
}

export async function transitionPurchaseOrder(formData: FormData) {
  await getCurrentStaff();
  const purchaseOrderId = formText(formData, "purchaseOrderId");
  const toStatus = formText(formData, "toStatus");
  if (!purchaseOrderId || !["draft", "submitted", "confirmed", "closed", "cancelled"].includes(toStatus)) {
    redirect(routeMessage(purchasingPath, "error", "The purchase-order action is invalid."));
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("transition_purchase_order", {
      p_purchase_order_id: purchaseOrderId,
      p_to_status: toStatus,
    });
    if (error) throw error;
  } catch (error) {
    redirect(routeMessage(purchasingPath, "error", operationError(error, "The purchase order could not be progressed.")));
  }

  revalidatePath(purchasingPath);
  redirect(routeMessage(purchasingPath, "created", `Purchase order marked ${toStatus}.`));
}

export async function receivePurchaseOrderLine(formData: FormData) {
  await getCurrentStaff();
  const lineId = formText(formData, "lineId");
  const destinationBinId = formText(formData, "destinationBinId");
  const quantity = optionalNumber(formData, "quantity");
  if (!lineId || !destinationBinId || quantity === undefined || !Number.isFinite(quantity) || quantity <= 0) {
    redirect(routeMessage(purchasingPath, "error", "Order line, destination bin and positive quantity are required."));
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("receive_purchase_order_line", {
      p_purchase_order_line_id: lineId,
      p_quantity: quantity,
      p_destination_bin_id: destinationBinId,
      p_supplier_document_no: optionalText(formData, "supplierDocumentNo") ?? "",
      p_supplier_lot: optionalText(formData, "supplierLot") ?? "",
      p_serial_no: optionalText(formData, "serialNo") ?? "",
      p_expiry_date: optionalText(formData, "expiryDate") ?? null,
      p_idempotency_key: randomUUID(),
    });
    if (error) throw error;
  } catch (error) {
    redirect(routeMessage(purchasingPath, "error", operationError(error, "The goods receipt could not be posted.")));
  }

  revalidatePath(purchasingPath);
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  redirect(routeMessage(purchasingPath, "created", "Goods receipt posted to stock."));
}

export async function recordSupplierInvoice(formData: FormData) {
  await getCurrentStaff();
  const purchaseOrderId = formText(formData, "purchaseOrderId");
  const lineId = formText(formData, "lineId");
  const supplierInvoiceNo = formText(formData, "supplierInvoiceNo");
  const invoiceDate = formText(formData, "invoiceDate");
  const quantity = optionalNumber(formData, "quantity");
  const unitCost = optionalNumber(formData, "unitCost");
  const landedCost = optionalNumber(formData, "landedCost") ?? 0;
  if (!purchaseOrderId || !lineId || !supplierInvoiceNo || !invoiceDate || quantity === undefined || !Number.isFinite(quantity) || quantity <= 0 || unitCost === undefined || !Number.isFinite(unitCost) || unitCost < 0 || !Number.isFinite(landedCost) || landedCost < 0) {
    redirect(routeMessage(purchasingPath, "error", "Supplier invoice number, date and valid invoice line are required."));
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("record_supplier_invoice", {
      p_purchase_order_id: purchaseOrderId,
      p_supplier_invoice_no: supplierInvoiceNo,
      p_invoice_date: invoiceDate,
      p_landed_cost: landedCost,
      p_lines: [{ purchase_order_line_id: lineId, quantity, unit_cost: unitCost }],
      p_evidence_note: optionalText(formData, "evidenceNote") ?? "",
    });
    if (error) throw error;
  } catch (error) {
    redirect(routeMessage(purchasingPath, "error", operationError(error, "The supplier invoice could not be matched.")));
  }
  revalidatePath(purchasingPath);
  redirect(routeMessage(purchasingPath, "created", "Supplier invoice recorded and three-way match evaluated."));
}
