import { describe, it, expect } from "vitest";
import { sumPayments, paymentStatusFor } from "@/features/invoices/payments";

const p = (amount: number) => ({ amount });

describe("payments", () => {
  it("sums payment amounts (rounded to 3dp)", () => {
    expect(sumPayments([p(10), p(0.333), p(0.333), p(0.334)])).toBe(11);
  });
  it("is unpaid with no payments", () => { expect(paymentStatusFor(100, [])).toBe("unpaid"); });
  it("is partial below total", () => { expect(paymentStatusFor(100, [p(40)])).toBe("partial"); });
  it("is paid at or above total", () => { expect(paymentStatusFor(100, [p(60), p(40)])).toBe("paid"); });
});
