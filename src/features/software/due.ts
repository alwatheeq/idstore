import type { Vehicle } from "@/features/customers/types";

export type SoftwareFields = Pick<Vehicle, "software_version" | "target_software_version">;

/**
 * A vehicle is "due" for a software update when a target version is set and it
 * differs from the current installed version. Derived, never stored — the only
 * source of truth is the two version fields, so every surface stays consistent.
 * A null/blank current with a target set counts as due (we know the goal, not
 * the state). Versions are trim-compared as opaque strings (no semver ordering).
 */
export function isUpdateDue(v: SoftwareFields): boolean {
  const target = (v.target_software_version ?? "").trim();
  if (target === "") return false;
  const current = (v.software_version ?? "").trim();
  return current !== target;
}

export function filterDueVehicles<T extends SoftwareFields>(vehicles: T[]): T[] {
  return vehicles.filter(isUpdateDue);
}
