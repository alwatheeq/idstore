import { describe, it, expect } from "vitest";
import { computeLineTotal, computeInvoiceTotals, derivePaymentStatus } from "@/lib/money";

describe("computeLineTotal", () => {
  it("multiplies quantity by unit price with no discount", () => {
    expect(computeLineTotal({ quantity: 2, unitPrice: 12.5, discountType: "none", discountValue: 0 })).toBe(25);
  });
  it("subtracts a fixed amount discount", () => {
    expect(computeLineTotal({ quantity: 1, unitPrice: 100, discountType: "amount", discountValue: 15 })).toBe(85);
  });
  it("subtracts a percent discount", () => {
    expect(computeLineTotal({ quantity: 1, unitPrice: 200, discountType: "percent", discountValue: 10 })).toBe(180);
  });
  it("rounds to 3 decimals (JOD)", () => {
    expect(computeLineTotal({ quantity: 3, unitPrice: 0.3333, discountType: "none", discountValue: 0 })).toBe(1);
  });
  it("never returns a negative line total", () => {
    expect(computeLineTotal({ quantity: 1, unitPrice: 10, discountType: "amount", discountValue: 999 })).toBe(0);
  });

  // Extra edge cases with genuine value
  it("rounds a percent discount that produces 3-decimal intermediate (JOD)", () => {
    // 3 * 10.005 * 10% = 3.0015 => gross 30.015, discount 3.0015, net 27.0135 => 27.014
    expect(computeLineTotal({ quantity: 3, unitPrice: 10.005, discountType: "percent", discountValue: 10 })).toBe(27.014);
  });
  it("handles zero quantity", () => {
    expect(computeLineTotal({ quantity: 0, unitPrice: 500, discountType: "none", discountValue: 0 })).toBe(0);
  });
  it("handles zero unit price", () => {
    expect(computeLineTotal({ quantity: 5, unitPrice: 0, discountType: "percent", discountValue: 50 })).toBe(0);
  });

  // Fix I-3: non-finite inputs must not propagate NaN/Infinity
  it("returns 0 for a NaN unitPrice (non-finite guard)", () => {
    expect(computeLineTotal({ quantity: 2, unitPrice: NaN, discountType: "none", discountValue: 0 })).toBe(0);
  });
  it("returns 0 for an Infinity quantity (non-finite guard)", () => {
    expect(computeLineTotal({ quantity: Infinity, unitPrice: 5, discountType: "none", discountValue: 0 })).toBe(0);
  });
});

describe("computeInvoiceTotals", () => {
  it("sums gross, discounts, and net across lines", () => {
    const lines = [
      { quantity: 1, unitPrice: 100, discountType: "amount" as const, discountValue: 10 },
      { quantity: 2, unitPrice: 50, discountType: "percent" as const, discountValue: 10 },
    ];
    expect(computeInvoiceTotals(lines)).toEqual({ subtotal: 200, discountTotal: 20, total: 180 });
  });

  // Extra edge cases
  it("returns zeros for an empty line array", () => {
    expect(computeInvoiceTotals([])).toEqual({ subtotal: 0, discountTotal: 0, total: 0 });
  });
  it("handles a single no-discount line", () => {
    const lines = [{ quantity: 4, unitPrice: 25.500, discountType: "none" as const, discountValue: 0 }];
    expect(computeInvoiceTotals(lines)).toEqual({ subtotal: 102, discountTotal: 0, total: 102 });
  });

  // Regression: invoice total must equal the sum of per-line rounded totals (I-2).
  // Two lines of unitPrice 1.0015 each round individually to 1.002, summing to 2.004.
  // The old aggregate approach would compute round3(2*1.0015)=2.003 and return that,
  // which is off by 0.001. The new code sums computeLineTotal per line, so total = 2.004.
  it("reconciles total with sum of per-line rounded totals (regression for aggregate penny-off)", () => {
    const lines = [
      { quantity: 1, unitPrice: 1.0015, discountType: "none" as const, discountValue: 0 },
      { quantity: 1, unitPrice: 1.0015, discountType: "none" as const, discountValue: 0 },
    ];
    const { total } = computeInvoiceTotals(lines);
    // Each line rounds to 1.002; correct sum is 2.004, not the aggregate 2.003
    expect(total).toBe(2.004);
  });
});

describe("derivePaymentStatus", () => {
  it("is unpaid at zero", () => { expect(derivePaymentStatus(100, 0)).toBe("unpaid"); });
  it("is partial below total", () => { expect(derivePaymentStatus(100, 40)).toBe("partial"); });
  it("is paid at or above total", () => { expect(derivePaymentStatus(100, 100)).toBe("paid"); });

  // Extra edge cases
  it("is paid when overpaid (e.g. advance deposit exceeds total)", () => {
    expect(derivePaymentStatus(100, 150)).toBe("paid");
  });
  it("is unpaid when paidSum is negative (data integrity guard)", () => {
    expect(derivePaymentStatus(100, -5)).toBe("unpaid");
  });

  // Fix I-3: non-finite inputs must not crash and must return a safe status
  it("returns unpaid when both total and paidSum are NaN (non-finite guard)", () => {
    expect(derivePaymentStatus(NaN, NaN)).toBe("unpaid");
  });
});
