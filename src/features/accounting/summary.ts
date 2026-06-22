import type {
  MonthBucket,
  MethodBreakdown,
  OpenInvoice,
  ReceivablesSummary,
  ReceivedPO,
  PurchasesSummary,
  PaymentMethod,
} from "./types";

const round3 = (n: number): number => Math.round(n * 1000 + Number.EPSILON) / 1000;
const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function sumPayments(rows: { amount: number }[]): number {
  return round3(rows.reduce((s, r) => s + num(r.amount), 0));
}

export function bucketByMonth(rows: { paid_at: string; amount: number }[]): MonthBucket[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const month = r.paid_at.slice(0, 7); // "YYYY-MM" from an ISO string
    map.set(month, (map.get(month) ?? 0) + num(r.amount));
  }
  return [...map.entries()]
    .map(([month, total]) => ({ month, total: round3(total) }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export function groupByMethod(rows: { method: PaymentMethod; amount: number }[]): MethodBreakdown {
  const order: PaymentMethod[] = ["cash", "card", "transfer"];
  const map = new Map<PaymentMethod, { count: number; total: number }>();
  for (const r of rows) {
    const e = map.get(r.method) ?? { count: 0, total: 0 };
    e.count += 1;
    e.total += num(r.amount);
    map.set(r.method, e);
  }
  return order
    .filter((m) => map.has(m))
    .map((m) => ({ method: m, count: map.get(m)!.count, total: round3(map.get(m)!.total) }));
}

export function computeReceivables(
  rows: {
    id: string;
    invoice_number: number;
    total: number;
    paid: number;
    issued_at: string;
    customer_name: string;
  }[],
): ReceivablesSummary {
  const invoices: OpenInvoice[] = rows
    .map((r) => ({
      id: r.id,
      invoice_number: r.invoice_number,
      total: num(r.total),
      paid: num(r.paid),
      balance: round3(Math.max(0, num(r.total) - num(r.paid))),
      issued_at: r.issued_at,
      customer_name: r.customer_name,
    }))
    .filter((r) => r.balance > 0)
    .sort((a, b) => b.balance - a.balance);
  const total = round3(invoices.reduce((s, r) => s + r.balance, 0));
  return { total, invoices };
}

export function sumReceivedPurchases(
  rows: {
    id: string;
    po_number: number;
    supplier_name: string | null;
    received_at: string | null;
    lines: { received_qty: number; unit_cost: number }[];
  }[],
): PurchasesSummary {
  const orders: ReceivedPO[] = rows
    .map((r) => ({
      id: r.id,
      po_number: r.po_number,
      supplier_name: r.supplier_name,
      received_at: r.received_at,
      value: round3(r.lines.reduce((s, l) => s + num(l.received_qty) * num(l.unit_cost), 0)),
    }))
    .sort((a, b) => (b.received_at ?? "").localeCompare(a.received_at ?? ""));
  const total = round3(orders.reduce((s, o) => s + o.value, 0));
  return { total, orders };
}
