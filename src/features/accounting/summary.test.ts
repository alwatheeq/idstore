import { describe, it, expect } from "vitest";
import {
  sumPayments,
  bucketByMonth,
  groupByMethod,
  computeReceivables,
  sumReceivedPurchases,
} from "./summary";

describe("sumPayments", () => {
  it("sums amounts at 3-dp precision", () => {
    expect(sumPayments([{ amount: 10.1 }, { amount: 0.2 }, { amount: 5 }])).toBe(15.3);
  });
  it("returns 0 for no rows", () => {
    expect(sumPayments([])).toBe(0);
  });
});

describe("bucketByMonth", () => {
  it("groups by YYYY-MM ascending", () => {
    const rows = [
      { paid_at: "2026-06-02T08:00:00.000Z", amount: 5 },
      { paid_at: "2026-06-20T08:00:00.000Z", amount: 3 },
      { paid_at: "2026-05-11T08:00:00.000Z", amount: 2 },
    ];
    expect(bucketByMonth(rows)).toEqual([
      { month: "2026-05", total: 2 },
      { month: "2026-06", total: 8 },
    ]);
  });
});

describe("groupByMethod", () => {
  it("groups by method in cash/card/transfer order, omitting absent methods", () => {
    const rows = [
      { method: "cash" as const, amount: 10 },
      { method: "transfer" as const, amount: 4 },
      { method: "cash" as const, amount: 5 },
    ];
    expect(groupByMethod(rows)).toEqual([
      { method: "cash", count: 2, total: 15 },
      { method: "transfer", count: 1, total: 4 },
    ]);
  });
  it("method totals reconcile to sumPayments (invariant)", () => {
    const rows = [
      { method: "cash" as const, amount: 10 },
      { method: "card" as const, amount: 2.5 },
    ];
    const byMethod = groupByMethod(rows).reduce((s, r) => s + r.total, 0);
    expect(Math.round(byMethod * 1000) / 1000).toBe(sumPayments(rows));
  });
});

describe("computeReceivables", () => {
  it("computes balance = total - paid, drops settled, sorts by balance desc", () => {
    const r = computeReceivables([
      { id: "a", invoice_number: 1, total: 100, paid: 40, issued_at: "x", customer_name: "Ahmad" },
      { id: "b", invoice_number: 2, total: 50, paid: 50, issued_at: "x", customer_name: "Sara" },
      { id: "c", invoice_number: 3, total: 80, paid: 0, issued_at: "x", customer_name: "Omar" },
    ]);
    expect(r.total).toBe(140);
    expect(r.invoices.map((i) => i.id)).toEqual(["c", "a"]);
    expect(r.invoices[1].balance).toBe(60);
  });
});

describe("sumReceivedPurchases", () => {
  it("values each PO as Σ(received_qty × unit_cost), newest first", () => {
    const r = sumReceivedPurchases([
      {
        id: "p1", po_number: 1, supplier_name: "ACME", received_at: "2026-06-01T00:00:00.000Z",
        lines: [{ received_qty: 2, unit_cost: 10 }, { received_qty: 1, unit_cost: 5 }],
      },
      {
        id: "p2", po_number: 2, supplier_name: null, received_at: "2026-06-10T00:00:00.000Z",
        lines: [{ received_qty: 3, unit_cost: 4 }],
      },
    ]);
    expect(r.total).toBe(37);
    expect(r.orders.map((o) => o.id)).toEqual(["p2", "p1"]);
    expect(r.orders[1].value).toBe(25);
  });
});
