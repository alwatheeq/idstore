import type { DateRange, PresetKey } from "./types";

/** Local midnight at year/monthIndex/day, as an ISO string. `new Date(y, m, d)`
 *  normalizes month under/overflow (e.g. m = -1 → December of prior year). */
const iso = (y: number, m: number, d: number): string => new Date(y, m, d).toISOString();

export function presetRange(key: Exclude<PresetKey, "custom">, now: Date): DateRange {
  const y = now.getFullYear();
  const m = now.getMonth();
  if (key === "this-month") return { from: iso(y, m, 1), to: iso(y, m + 1, 1) };
  if (key === "last-month") return { from: iso(y, m - 1, 1), to: iso(y, m, 1) };
  return { from: iso(y, 0, 1), to: iso(y + 1, 0, 1) }; // this-year
}
