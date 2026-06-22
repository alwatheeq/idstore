import { describe, it, expect } from "vitest";
import { presetRange } from "./period";

const NOW = new Date(2026, 5, 15, 10, 0, 0); // 15 Jun 2026, local

describe("presetRange", () => {
  it("this-month spans the first of this month to the first of next", () => {
    const r = presetRange("this-month", NOW);
    expect(r.from).toBe(new Date(2026, 5, 1).toISOString());
    expect(r.to).toBe(new Date(2026, 6, 1).toISOString());
  });

  it("last-month spans the previous calendar month", () => {
    const r = presetRange("last-month", NOW);
    expect(r.from).toBe(new Date(2026, 4, 1).toISOString());
    expect(r.to).toBe(new Date(2026, 5, 1).toISOString());
  });

  it("this-year spans Jan 1 to next Jan 1", () => {
    const r = presetRange("this-year", NOW);
    expect(r.from).toBe(new Date(2026, 0, 1).toISOString());
    expect(r.to).toBe(new Date(2027, 0, 1).toISOString());
  });

  it("handles a January 'now' rolling last-month into the prior year", () => {
    const jan = new Date(2026, 0, 10);
    const r = presetRange("last-month", jan);
    expect(r.from).toBe(new Date(2025, 11, 1).toISOString());
    expect(r.to).toBe(new Date(2026, 0, 1).toISOString());
  });
});
