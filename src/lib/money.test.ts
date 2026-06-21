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
});
