import type { PaymentStatus } from "@/lib/money";

export type PaymentMethod = "cash" | "card" | "transfer";

export interface Invoice {
  id: string;
  service_order_id: string;
  invoice_number: number;
  currency: string;
  subtotal: number;
  discount_total: number;
  total: number;
  payment_status: PaymentStatus;
  issued_at: string;
}

export interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  method: PaymentMethod;
  note: string | null;
  paid_at: string;
}

export type InvoiceListRow = Invoice & {
  service_orders: { order_number: number; customers: { name: string } | null } | null;
};

export type InvoiceDetailRow = InvoiceListRow;
