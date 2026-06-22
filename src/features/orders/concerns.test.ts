import { describe, it, expect } from "vitest";
import { checkedCount, toggleConcern, type Concern } from "./concerns";

const list: Concern[] = [
  { key: "wont_charge", checked: false },
  { key: "noise", checked: true },
  { key: "software", checked: false },
];

describe("checkedCount", () => {
  it("counts checked concerns", () => {
    expect(checkedCount(list)).toBe(1);
    expect(checkedCount([])).toBe(0);
  });
});

describe("toggleConcern", () => {
  it("flips only the matching concern and returns a new array", () => {
    const next = toggleConcern(list, "wont_charge");
    expect(next.find((c) => c.key === "wont_charge")?.checked).toBe(true);
    expect(next.find((c) => c.key === "noise")?.checked).toBe(true);
    expect(next).not.toBe(list);
  });
  it("ignores unknown keys", () => {
    expect(toggleConcern(list, "nope")).toEqual(list);
  });
});
