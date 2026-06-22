/** A part is "low" when it has a reorder level set and on-hand is at or below it. */
export function isLowStock(i: { quantity: number; reorder_level: number }): boolean {
  return i.reorder_level > 0 && i.quantity <= i.reorder_level;
}

export function lowStockItems<T extends { quantity: number; reorder_level: number }>(
  items: T[],
): T[] {
  return items.filter(isLowStock);
}

/** Stock value = Σ(quantity × cost), rounded to 3 dp (JOD). */
export function stockValue(items: { quantity: number; cost: number }[]): number {
  const total = items.reduce((s, i) => s + i.quantity * i.cost, 0);
  return Math.round(total * 1000) / 1000;
}
