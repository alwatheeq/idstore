import { supabase } from "@/lib/supabase";
import type { PaymentMethod } from "./types";

const num = (v: unknown): number => Number(v ?? 0);

/** Payments received within [from, to); branch reached via parent invoice. */
export async function fetchPayments(
  branchId: string | null,
  from: string,
  to: string,
): Promise<{ paid_at: string; amount: number; method: PaymentMethod }[]> {
  let q = supabase
    .from("payments")
    .select("amount, method, paid_at, invoices!inner(branch_id)")
    .gte("paid_at", from)
    .lt("paid_at", to);
  if (branchId) q = q.eq("invoices.branch_id", branchId);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as { amount: number; method: PaymentMethod; paid_at: string }[]).map((r) => ({
    paid_at: r.paid_at,
    amount: num(r.amount),
    method: r.method,
  }));
}

type OpenInvoiceRow = {
  id: string;
  invoice_number: number;
  total: number;
  issued_at: string;
  payments: { amount: number }[] | null;
  service_orders: { customers: { name: string } | null } | null;
};

/** All unpaid/partial invoices (as of now), with their paid-sum + customer name. */
export async function fetchOpenInvoices(
  branchId: string | null,
): Promise<
  { id: string; invoice_number: number; total: number; issued_at: string; paid: number; customer_name: string }[]
> {
  let q = supabase
    .from("invoices")
    .select(
      "id, invoice_number, total, issued_at, payment_status, payments(amount), service_orders(customers(name))",
    )
    .in("payment_status", ["unpaid", "partial"]);
  if (branchId) q = q.eq("branch_id", branchId);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as unknown as OpenInvoiceRow[]).map((r) => ({
    id: r.id,
    invoice_number: r.invoice_number,
    total: num(r.total),
    issued_at: r.issued_at,
    paid: (r.payments ?? []).reduce((s, p) => s + num(p.amount), 0),
    customer_name: r.service_orders?.customers?.name ?? "—",
  }));
}

type ReceivedPORow = {
  id: string;
  po_number: number;
  received_at: string | null;
  suppliers: { name: string } | null;
  purchase_order_lines: { received_qty: number; unit_cost: number }[] | null;
};

/** Purchase orders received within [from, to), with supplier + lines. */
export async function fetchReceivedPurchases(
  branchId: string | null,
  from: string,
  to: string,
): Promise<
  {
    id: string;
    po_number: number;
    received_at: string | null;
    supplier_name: string | null;
    lines: { received_qty: number; unit_cost: number }[];
  }[]
> {
  let q = supabase
    .from("purchase_orders")
    .select("id, po_number, received_at, suppliers(name), purchase_order_lines(received_qty, unit_cost)")
    .eq("status", "received")
    .gte("received_at", from)
    .lt("received_at", to);
  if (branchId) q = q.eq("branch_id", branchId);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as unknown as ReceivedPORow[]).map((r) => ({
    id: r.id,
    po_number: r.po_number,
    received_at: r.received_at,
    supplier_name: r.suppliers?.name ?? null,
    lines: (r.purchase_order_lines ?? []).map((l) => ({
      received_qty: num(l.received_qty),
      unit_cost: num(l.unit_cost),
    })),
  }));
}
