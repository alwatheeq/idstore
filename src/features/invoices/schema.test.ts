import { describe, it, expect } from "vitest";
import { paymentSchema } from "@/features/invoices/schema";

describe("paymentSchema", () => {
  it("requires a positive amount", () => {
    expect(() => paymentSchema.parse({ amount: "0", method: "cash" })).toThrow();
    expect(() => paymentSchema.parse({ amount: "", method: "cash" })).toThrow();
  });
  it("coerces amount and defaults method to cash; nulls empty note", () => {
    const p = paymentSchema.parse({ amount: "12.5", note: "" });
    expect(p.amount).toBe(12.5);
    expect(p.method).toBe("cash");
    expect(p.note).toBeNull();
  });
});
