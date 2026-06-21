import { describe, it, expect } from "vitest";
import { isUpdateDue, filterDueVehicles } from "./due";

describe("isUpdateDue", () => {
  it("is not due when no target is set", () => {
    expect(isUpdateDue({ software_version: "3.2", target_software_version: null })).toBe(false);
    expect(isUpdateDue({ software_version: "3.2", target_software_version: "" })).toBe(false);
    expect(isUpdateDue({ software_version: "3.2", target_software_version: "   " })).toBe(false);
  });

  it("is not due when current equals target", () => {
    expect(isUpdateDue({ software_version: "4.0", target_software_version: "4.0" })).toBe(false);
  });

  it("ignores surrounding whitespace when comparing", () => {
    expect(isUpdateDue({ software_version: " 4.0 ", target_software_version: "4.0" })).toBe(false);
  });

  it("is due when current differs from target", () => {
    expect(isUpdateDue({ software_version: "3.2", target_software_version: "4.0" })).toBe(true);
  });

  it("is due when target is set but current is unknown", () => {
    expect(isUpdateDue({ software_version: null, target_software_version: "4.0" })).toBe(true);
    expect(isUpdateDue({ software_version: "", target_software_version: "4.0" })).toBe(true);
  });
});

describe("filterDueVehicles", () => {
  it("returns only the due vehicles", () => {
    const vehicles = [
      { id: "a", software_version: "3.2", target_software_version: "4.0" }, // due
      { id: "b", software_version: "4.0", target_software_version: "4.0" }, // up to date
      { id: "c", software_version: "1.0", target_software_version: null }, // no target
      { id: "d", software_version: null, target_software_version: "2.0" }, // due (unknown current)
    ];
    expect(filterDueVehicles(vehicles).map((v) => v.id)).toEqual(["a", "d"]);
  });
});
