import { describe, it, expect } from "vitest";
import { ORDER_STATUSES, nextStatus, canAdvance } from "@/features/orders/status";

describe("order status flow", () => {
  it("lists the lifecycle in order", () => {
    expect(ORDER_STATUSES[0]).toBe("appointment");
    expect(ORDER_STATUSES).toContain("in_progress");
    expect(ORDER_STATUSES[ORDER_STATUSES.length - 1]).toBe("cancelled");
  });
  it("advances to the next linear status", () => {
    expect(nextStatus("intake")).toBe("diagnosis");
    expect(nextStatus("qc")).toBe("ready");
  });
  it("does not advance past 'closed'", () => { expect(nextStatus("closed")).toBeNull(); });
  it("cannot advance a cancelled or closed order", () => {
    expect(canAdvance("cancelled")).toBe(false);
    expect(canAdvance("closed")).toBe(false);
    expect(canAdvance("intake")).toBe(true);
  });
});
