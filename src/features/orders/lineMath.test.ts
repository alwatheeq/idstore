import { describe, it, expect } from "vitest";
import { lineToInput, computeLineTotalFromRow, computeOrderTotals } from "@/features/orders/lineMath";
import type { ServiceOrderLine } from "@/features/orders/types";

const row = (over: Partial<ServiceOrderLine>): ServiceOrderLine => ({
  id: "l", service_order_id: "o", line_type: "service", description: "x",
  quantity: 1, unit_price: 0, discount_type: "none", discount_value: 0, line_total: 0,
  created_at: "", ...over,
});

describe("lineMath", () => {
  it("maps a row to money LineInput", () => {
    expect(lineToInput(row({ quantity: 2, unit_price: 12.5 }))).toEqual({
      quantity: 2, unitPrice: 12.5, discountType: "none", discountValue: 0,
    });
  });
  it("computes a line total from a row (percent discount)", () => {
    expect(computeLineTotalFromRow(row({ quantity: 1, unit_price: 200, discount_type: "percent", discount_value: 10 }))).toBe(180);
  });
  it("computes order totals reconciling with summed line totals", () => {
    const lines = [
      row({ quantity: 1, unit_price: 100, discount_type: "amount", discount_value: 10 }),
      row({ quantity: 2, unit_price: 50, discount_type: "percent", discount_value: 10 }),
    ];
    expect(computeOrderTotals(lines)).toEqual({ subtotal: 200, discountTotal: 20, total: 180 });
  });
});
