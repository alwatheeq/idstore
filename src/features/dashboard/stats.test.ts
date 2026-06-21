import { describe, it, expect } from "vitest";
import { computeDashboard } from "@/features/dashboard/stats";
import type { OrderListRow } from "@/features/orders/types";
import type { InvoiceListRow } from "@/features/invoices/types";

const order = (over: Partial<OrderListRow>): OrderListRow => ({
  id: "o", branch_id: "b", vehicle_id: "v", customer_id: "c", order_number: 1, status: "intake",
  odometer_at_intake: null, charge_percent: null, hv_battery_state: null, reported_concerns: null,
  intake_notes: null, approved_at: null, approved_by: null, closed_at: null,
  next_service_due_date: null, next_service_due_odometer: null, created_at: "", updated_at: "",
  customers: null, vehicles: null, ...over,
});
const invoice = (over: Partial<InvoiceListRow>): InvoiceListRow => ({
  id: "i", service_order_id: "o", invoice_number: 1, currency: "JOD",
  subtotal: 0, discount_total: 0, total: 0, payment_status: "unpaid", issued_at: "",
  service_orders: null, ...over,
});

describe("computeDashboard", () => {
  const now = new Date("2026-06-21T10:00:00Z");

  it("counts cars in workshop (active statuses, excludes appointment/closed/cancelled)", () => {
    const orders = [
      order({ status: "intake" }), order({ status: "in_progress" }), order({ status: "ready" }),
      order({ status: "appointment" }), order({ status: "closed" }), order({ status: "cancelled" }),
    ];
    expect(computeDashboard(orders, [], now).carsInWorkshop).toBe(3);
  });
  it("counts awaiting approval and ready for handover", () => {
    const orders = [order({ status: "awaiting_approval" }), order({ status: "awaiting_approval" }), order({ status: "ready" })];
    const s = computeDashboard(orders, [], now);
    expect(s.awaitingApproval).toBe(2);
    expect(s.readyForHandover).toBe(1);
  });
  it("sums invoiced-today by issued_at date only", () => {
    const invoices = [
      invoice({ total: 100, issued_at: "2026-06-21T08:00:00Z" }),
      invoice({ total: 50, issued_at: "2026-06-21T23:00:00Z" }),
      invoice({ total: 999, issued_at: "2026-06-20T23:00:00Z" }),
    ];
    expect(computeDashboard([], invoices, now).invoicedToday).toBe(150);
  });
  it("groups active orders into board columns, omitting empty stages", () => {
    const orders = [order({ status: "intake", id: "a" }), order({ status: "intake", id: "b" }), order({ status: "qc", id: "c" })];
    const s = computeDashboard(orders, [], now);
    expect(s.board.find((c) => c.status === "intake")?.orders.length).toBe(2);
    expect(s.board.some((c) => c.status === "diagnosis")).toBe(false);
  });
});
