import { describe, it, expect } from "vitest";
import i18n from "@/i18n";

describe("i18n init", () => {
  it("resolves English keys by default", () => {
    expect(i18n.t("nav.dashboard")).toBe("Dashboard");
    expect(i18n.t("auth.signOut")).toBe("Sign out");
  });
  it("resolves Arabic after changeLanguage", async () => {
    await i18n.changeLanguage("ar");
    expect(i18n.t("nav.dashboard")).toBe("لوحة التحكم");
    await i18n.changeLanguage("en"); // reset for other tests
  });
});
