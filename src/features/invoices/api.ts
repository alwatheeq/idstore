import { supabase } from "@/lib/supabase";
import { listLines } from "@/features/orders/api";
import { computeOrderTotals } from "@/features/orders/lineMath";
import { sumPayments, paymentStatusFor } from "./payments";
import type { Invoice, Payment, InvoiceListRow, InvoiceDetailRow } from "./types";
import type { PaymentPayload } from "./schema";

export async function getInvoiceByOrder(orderId: string): Promise<Invoice | null> {
  const { data, error } = await supabase.from("invoices").select("*").eq("service_order_id", orderId).maybeSingle();
  if (error) throw error;
  return (data as Invoice) ?? null;
}

export async function generateInvoice(orderId: string): Promise<Invoice> {
  const existing = await getInvoiceByOrder(orderId);
  if (existing) return existing; // idempotent: one invoice per order
  const lines = await listLines(orderId);
  const totals = computeOrderTotals(lines);
  const { data, error } = await supabase.from("invoices").insert({
    service_order_id: orderId, currency: "JOD",
    subtotal: totals.subtotal, discount_total: totals.discountTotal, total: totals.total,
    payment_status: "unpaid",
  }).select().single();
  if (error) throw error;
  return data as Invoice;
}

export async function getInvoice(id: string): Promise<InvoiceDetailRow | null> {
  const { data, error } = await supabase.from("invoices")
    .select("*, service_orders(order_number, customers(name))").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as unknown as InvoiceDetailRow) ?? null;
}

export async function listInvoices(status?: string): Promise<InvoiceListRow[]> {
  let q = supabase.from("invoices")
    .select("*, service_orders(order_number, customers(name))")
    .order("issued_at", { ascending: false });
  if (status) q = q.eq("payment_status", status);
  const { data, error } = await q;
  if (error) throw error;
  return data as unknown as InvoiceListRow[];
}

export async function listPayments(invoiceId: string): Promise<Payment[]> {
  const { data, error } = await supabase.from("payments")
    .select("*").eq("invoice_id", invoiceId).order("paid_at", { ascending: true });
  if (error) throw error;
  return data as Payment[];
}

async function refreshStatus(invoiceId: string): Promise<void> {
  const { data: inv, error: e1 } = await supabase.from("invoices").select("total").eq("id", invoiceId).single();
  if (e1) throw e1;
  const payments = await listPayments(invoiceId);
  const status = paymentStatusFor((inv as { total: number }).total, payments);
  const { error } = await supabase.from("invoices").update({ payment_status: status }).eq("id", invoiceId);
  if (error) throw error;
}

export async function addPayment(invoiceId: string, payload: PaymentPayload): Promise<Payment> {
  const { data, error } = await supabase.from("payments")
    .insert({ ...payload, invoice_id: invoiceId }).select().single();
  if (error) throw error;
  await refreshStatus(invoiceId);
  return data as Payment;
}

export async function deletePayment(p: Payment): Promise<void> {
  const { error } = await supabase.from("payments").delete().eq("id", p.id);
  if (error) throw error;
  await refreshStatus(p.invoice_id);
}

export { sumPayments };
