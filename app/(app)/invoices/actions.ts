"use server";

import { submissionKey } from "@/lib/actions/submission-key";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formText, operationError, optionalNumber, optionalText, routeMessage } from "@/lib/actions/form";
import { getCurrentStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const invoicePath = "/invoices";

export async function createInvoice(formData: FormData) {
  await getCurrentStaff();
  const repairOrderId = formText(formData, "repairOrderId");
  if (!repairOrderId) redirect(routeMessage(invoicePath, "error", "Choose a repair order to invoice."));

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("create_invoice_from_repair_order", { p_repair_order_id: repairOrderId });
    if (error) throw error;
  } catch (error) {
    redirect(routeMessage(invoicePath, "error", operationError(error, "The draft invoice could not be created.")));
  }

  revalidatePath(invoicePath);
  redirect(routeMessage(invoicePath, "created", "Draft invoice created."));
}

export async function addInvoiceLine(formData: FormData) {
  await getCurrentStaff();
  const invoiceId = formText(formData, "invoiceId");
  const version = Number(formText(formData, "version"));
  const lineType = formText(formData, "lineType");
  const description = formText(formData, "description");
  const quantity = optionalNumber(formData, "quantity");
  const unitPrice = optionalNumber(formData, "unitPrice");
  const discountAmount = optionalNumber(formData, "discountAmount");
  const taxRate = optionalNumber(formData, "taxRate");
  if (!invoiceId || !Number.isSafeInteger(version) || !["labor", "part", "fee", "warranty", "goodwill"].includes(lineType)
      || !description || quantity === undefined || !Number.isFinite(quantity) || quantity <= 0
      || unitPrice === undefined || !Number.isFinite(unitPrice) || unitPrice < 0
      || discountAmount === undefined || !Number.isFinite(discountAmount) || discountAmount < 0
      || taxRate === undefined || !Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
    redirect(routeMessage(invoicePath, "error", "Enter a valid description, quantity, price, discount and tax rate."));
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("add_invoice_line", {
      p_invoice_id: invoiceId,
      p_expected_version: version,
      p_line_type: lineType,
      p_description: description,
      p_quantity: quantity,
      p_unit_price: unitPrice,
      p_discount_amount: discountAmount,
      p_tax_rate: taxRate,
    });
    if (error) throw error;
  } catch (error) {
    redirect(routeMessage(invoicePath, "error", operationError(error, "The invoice line could not be added.")));
  }

  revalidatePath(invoicePath);
  redirect(routeMessage(invoicePath, "created", "Invoice line added."));
}

export async function removeInvoiceLine(formData: FormData) {
  await getCurrentStaff();
  const invoiceLineId = formText(formData, "invoiceLineId");
  const version = Number(formText(formData, "version"));
  if (!invoiceLineId || !Number.isSafeInteger(version)) {
    redirect(routeMessage(invoicePath, "error", "The invoice line action is invalid."));
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("remove_invoice_line", {
      p_invoice_line_id: invoiceLineId,
      p_expected_version: version,
    });
    if (error) throw error;
  } catch (error) {
    redirect(routeMessage(invoicePath, "error", operationError(error, "The invoice line could not be removed.")));
  }

  revalidatePath(invoicePath);
  redirect(routeMessage(invoicePath, "created", "Invoice line removed."));
}

export async function postInvoice(formData: FormData) {
  await getCurrentStaff();
  const invoiceId = formText(formData, "invoiceId");
  const version = Number(formText(formData, "version"));
  if (!invoiceId || !Number.isSafeInteger(version)) {
    redirect(routeMessage(invoicePath, "error", "The invoice posting action is invalid."));
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("post_invoice", { p_invoice_id: invoiceId, p_expected_version: version });
    if (error) throw error;
  } catch (error) {
    redirect(routeMessage(invoicePath, "error", operationError(error, "The invoice could not be posted.")));
  }

  revalidatePath(invoicePath);
  revalidatePath("/dashboard");
  redirect(routeMessage(invoicePath, "created", "Invoice posted and queued for fiscal integration."));
}

export async function receivePayment(formData: FormData) {
  await getCurrentStaff();
  const invoiceId = formText(formData, "invoiceId");
  const amount = optionalNumber(formData, "amount");
  const method = formText(formData, "method");
  if (!invoiceId || amount === undefined || !Number.isFinite(amount) || amount <= 0
      || !["cash", "card", "bank_transfer", "payment_link", "fleet_account", "other"].includes(method)) {
    redirect(routeMessage(invoicePath, "error", "Choose an invoice, payment method and positive amount."));
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("receive_invoice_payment", {
      p_invoice_id: invoiceId,
      p_amount: amount,
      p_method: method,
      p_provider_ref: optionalText(formData, "providerRef") ?? "",
      p_idempotency_key: submissionKey(formData),
    });
    if (error) throw error;
  } catch (error) {
    redirect(routeMessage(invoicePath, "error", operationError(error, "The payment could not be recorded.")));
  }

  revalidatePath(invoicePath);
  revalidatePath("/dashboard");
  redirect(routeMessage(invoicePath, "created", "Payment received and allocated."));
}
