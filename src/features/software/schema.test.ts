import { describe, it, expect } from "vitest";
import { softwareUpdateSchema } from "./schema";

describe("softwareUpdateSchema", () => {
  it("requires to_version", () => {
    const r = softwareUpdateSchema.safeParse({ to_version: "", applied_at: "2026-06-22" });
    expect(r.success).toBe(false);
  });

  it("requires applied_at", () => {
    const r = softwareUpdateSchema.safeParse({ to_version: "4.0", applied_at: "" });
    expect(r.success).toBe(false);
  });

  it("normalizes blank optionals to null", () => {
    const r = softwareUpdateSchema.parse({
      to_version: "4.0",
      from_version: "  ",
      applied_at: "2026-06-22",
      notes: "",
      service_order_id: "",
    });
    expect(r.from_version).toBeNull();
    expect(r.notes).toBeNull();
    expect(r.service_order_id).toBeNull();
  });

  it("keeps trimmed values", () => {
    const r = softwareUpdateSchema.parse({
      to_version: "4.0",
      from_version: " 3.2 ",
      applied_at: "2026-06-22",
      notes: " OTA campaign ",
      service_order_id: "order-1",
    });
    expect(r.from_version).toBe("3.2");
    expect(r.notes).toBe("OTA campaign");
    expect(r.service_order_id).toBe("order-1");
  });
});
