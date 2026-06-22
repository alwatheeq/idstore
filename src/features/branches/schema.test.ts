import { describe, it, expect } from "vitest";
import { branchSchema } from "./schema";

describe("branchSchema", () => {
  it("requires a name", () => {
    expect(branchSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("defaults is_active to true and blanks optional fields to null", () => {
    const r = branchSchema.parse({ name: "Amman", code: "  ", phone: "", address: "" });
    expect(r.is_active).toBe(true);
    expect(r.code).toBeNull();
    expect(r.phone).toBeNull();
    expect(r.address).toBeNull();
  });

  it("keeps provided values", () => {
    const r = branchSchema.parse({ name: "Zarqa", code: "ZRQ", phone: "079", address: "St 1", is_active: false });
    expect(r).toMatchObject({ name: "Zarqa", code: "ZRQ", phone: "079", address: "St 1", is_active: false });
  });
});
