export interface Concern {
  key: string;
  checked: boolean;
}

/** Preset catalog of common EV service concerns. Labels live in i18n (`concerns.<key>`). */
export const CONCERN_KEYS = [
  "wont_charge",
  "slow_charging",
  "reduced_range",
  "warning_light",
  "no_power",
  "software",
  "braking",
  "noise",
  "ac_heating",
  "suspension",
  "tires",
  "body",
] as const;

/** How many concerns have been validated/checked off. */
export function checkedCount(concerns: Concern[]): number {
  return concerns.filter((c) => c.checked).length;
}

/** Toggle one concern's checked flag, returning a new array. */
export function toggleConcern(concerns: Concern[], key: string): Concern[] {
  return concerns.map((c) => (c.key === key ? { ...c, checked: !c.checked } : c));
}
