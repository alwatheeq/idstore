import { describe, it, expect } from "vitest";
import { intakeSchema, lineSchema } from "@/features/orders/schema";

describe("intakeSchema", () => {
  it("requires customer and vehicle", () => {
    expect(() => intakeSchema.parse({ customer_id: "", vehicle_id: "" })).toThrow();
  });
  it("coerces numeric intake fields and nulls blanks", () => {
    const p = intakeSchema.parse({
      customer_id: "c1", vehicle_id: "v1", odometer_at_intake: "15000",
      charge_percent: "80", hv_battery_state: "", reported_concerns: "", intake_notes: "",
    });
    expect(p.odometer_at_intake).toBe(15000);
    expect(p.charge_percent).toBe(80);
    expect(p.hv_battery_state).toBeNull();
  });
  it("rejects charge outside 0-100", () => {
    expect(() => intakeSchema.parse({ customer_id: "c", vehicle_id: "v", charge_percent: "150" })).toThrow();
  });
});

describe("lineSchema", () => {
  it("requires a description and positive qty", () => {
    expect(() => lineSchema.parse({ description: "", quantity: "1", unit_price: "10" })).toThrow();
    expect(() => lineSchema.parse({ description: "Brake pads", quantity: "0", unit_price: "10" })).toThrow();
  });
  it("coerces numbers and defaults discount to none", () => {
    const p = lineSchema.parse({ description: "Brake pads", quantity: "2", unit_price: "12.5" });
    expect(p.quantity).toBe(2);
    expect(p.unit_price).toBe(12.5);
    expect(p.discount_type).toBe("none");
    expect(p.discount_value).toBe(0);
  });
});
