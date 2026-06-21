import { describe, it, expect } from "vitest";
import { customerSchema, vehicleSchema } from "@/features/customers/schema";

describe("customerSchema", () => {
  it("accepts a valid customer and trims/normalizes empties to null", () => {
    const parsed = customerSchema.parse({ name: "Ahmad", phone: "", email: "", notes: "" });
    expect(parsed.name).toBe("Ahmad");
    expect(parsed.phone).toBeNull();
    expect(parsed.email).toBeNull();
  });
  it("rejects a missing name", () => {
    expect(() => customerSchema.parse({ name: "" })).toThrow();
  });
  it("rejects an invalid email", () => {
    expect(() => customerSchema.parse({ name: "A", email: "not-an-email" })).toThrow();
  });
});

describe("vehicleSchema", () => {
  it("coerces year/odometer from strings and nulls empties", () => {
    const parsed = vehicleSchema.parse({ plate_number: "12-3456", model_year: "2022", current_odometer: "15000", vin: "" });
    expect(parsed.model_year).toBe(2022);
    expect(parsed.current_odometer).toBe(15000);
    expect(parsed.vin).toBeNull();
  });
  it("leaves numeric fields null when blank", () => {
    const parsed = vehicleSchema.parse({ model_year: "", current_odometer: "" });
    expect(parsed.model_year).toBeNull();
    expect(parsed.current_odometer).toBeNull();
  });
  it("rejects a non-numeric year", () => {
    expect(() => vehicleSchema.parse({ model_year: "abc" })).toThrow();
  });
});
