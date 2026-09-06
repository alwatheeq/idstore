import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { translatePageText, translateUi, translateStatus } from "../../lib/i18n/ui";
import workshopArabic from "../../lib/i18n/workshop-ar.json";

test("reviewed workshop terminology overrides generated translations", () => {
  for (const [key, arabic] of Object.entries(workshopArabic)) {
    expect(translatePageText(key, "ar"), key).toBe(arabic);
    expect(arabic, key).toMatch(/[\u0600-\u06ff]/);
  }
  expect(translateUi("Work orders", "ar")).toBe("أوامر الصيانة");
  expect(translatePageText("Customer concern", "ar")).toBe("شكوى العميل");
  expect(translatePageText("Labor", "ar")).toBe("أجور الصيانة");
  expect(translateStatus("pass", "ar")).toBe("سليم");
  expect(translateStatus("fail", "ar")).toBe("غير سليم");
  expect(translatePageText("Promised handover", "en")).toBe("Promised handover");
  expect(translatePageText("State of charge (%)", "ar")).toBe("نسبة الشحن (%)");
});

test("vehicle profile UI and save action do not collect or clear factory warranty", () => {
  const page = fs.readFileSync("app/(app)/vehicles/page.tsx", "utf8");
  const actions = fs.readFileSync("app/(app)/vehicles/actions.ts", "utf8");
  expect(page).not.toMatch(/warranty/i);
  expect(page).toContain('name="firstRegistrationDate"');
  expect(page).toContain('name="driveUnit"');
  expect(page).toContain('name="softwareVersion"');
  expect(actions).toContain('rpc("update_vehicle_service_profile"');
  expect(actions).not.toMatch(/p_warranty_|warrantyStartDate|warrantyEndDate|warrantyDistanceKm/);
});
