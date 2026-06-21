import { describe, it, expect } from "vitest";
import en from "./en.json";
import ar from "./ar.json";

/** Recursively collect all dot-separated key paths from a nested object. */
function collectPaths(obj: Record<string, unknown>, prefix = ""): Set<string> {
  const paths = new Set<string>();
  for (const key of Object.keys(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    const val = obj[key];
    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      for (const nested of collectPaths(val as Record<string, unknown>, full)) {
        paths.add(nested);
      }
    } else {
      paths.add(full);
    }
  }
  return paths;
}

describe("i18n dictionaries", () => {
  const enPaths = collectPaths(en as unknown as Record<string, unknown>);
  const arPaths = collectPaths(ar as unknown as Record<string, unknown>);

  it("EN and AR have identical key sets (parity check)", () => {
    const missingInAr = [...enPaths].filter((k) => !arPaths.has(k));
    const missingInEn = [...arPaths].filter((k) => !enPaths.has(k));
    expect(missingInAr, "Keys in EN but missing in AR").toEqual([]);
    expect(missingInEn, "Keys in AR but missing in EN").toEqual([]);
  });

  it("en.nav.dashboard resolves to 'Dashboard'", () => {
    expect(en.nav.dashboard).toBe("Dashboard");
  });

  it("ar.nav.dashboard resolves to 'لوحة التحكم'", () => {
    expect(ar.nav.dashboard).toBe("لوحة التحكم");
  });

  it("en.common.language shows the Arabic label (toggle target)", () => {
    expect(en.common.language).toBe("العربية");
  });

  it("ar.common.language shows 'English' (toggle target)", () => {
    expect(ar.common.language).toBe("English");
  });

  it("en.auth.signOut resolves correctly", () => {
    expect(en.auth.signOut).toBe("Sign out");
  });

  it("ar.auth.signOut resolves correctly", () => {
    expect(ar.auth.signOut).toBe("تسجيل الخروج");
  });
});
