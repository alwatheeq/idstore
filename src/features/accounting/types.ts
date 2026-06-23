/** Mirrors the DB `payment_method` enum (also used by the invoices feature). */
export type PaymentMethod = "cash" | "card" | "transfer";

export type PresetKey = "this-month" | "last-month" | "this-year" | "custom";

/** Half-open range [from, to); both are ISO timestamp strings. */
export interface DateRange {
  from: string;
  to: string;
}

export interface MonthBucket {
  month: string; // "YYYY-MM"
  total: number;
}
export interface RevenueSummary {
  total: number;
  months: MonthBucket[];
}

export interface MethodRow {
  method: PaymentMethod;
  count: number;
  total: number;
}
export type MethodBreakdown = MethodRow[];

export interface OpenInvoice {
  id: string;
  invoice_number: number;
  total: number;
  paid: number;
  balance: number;
  issued_at: string;
  customer_name: string;
}
export interface ReceivablesSummary {
  total: number;
  invoices: OpenInvoice[];
}

export interface ReceivedPO {
  id: string;
  po_number: number;
  supplier_name: string | null;
  received_at: string | null;
  value: number;
}
export interface PurchasesSummary {
  total: number;
  orders: ReceivedPO[];
}

export interface AccountingSummary {
  revenue: RevenueSummary;
  receivables: ReceivablesSummary;
  methods: MethodBreakdown;
  purchases: PurchasesSummary;
}
