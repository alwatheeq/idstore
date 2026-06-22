import { describe, it, expect } from "vitest";
import { isLowStock, lowStockItems, stockValue } from "./stock";

describe("isLowStock", () => {
  it("is low when quantity ≤ reorder level (and a level is set)", () => {
    expect(isLowStock({ quantity: 2, reorder_level: 5 })).toBe(true);
    expect(isLowStock({ quantity: 5, reorder_level: 5 })).toBe(true);
    expect(isLowStock({ quantity: 6, reorder_level: 5 })).toBe(false);
  });
  it("is never low when no reorder level is set", () => {
    expect(isLowStock({ quantity: 0, reorder_level: 0 })).toBe(false);
  });
});

describe("lowStockItems", () => {
  it("filters to the low ones", () => {
    const items = [
      { id: "a", quantity: 1, reorder_level: 3 },
      { id: "b", quantity: 9, reorder_level: 3 },
      { id: "c", quantity: 0, reorder_level: 0 },
    ];
    expect(lowStockItems(items).map((i) => i.id)).toEqual(["a"]);
  });
});

describe("stockValue", () => {
  it("sums quantity × cost rounded to 3 dp", () => {
    expect(stockValue([{ quantity: 2, cost: 1.5 }, { quantity: 3, cost: 0.333 }])).toBe(3.999);
    expect(stockValue([])).toBe(0);
  });
});
