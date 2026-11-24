import { test, expect } from "@playwright/test";
import { currentNavigationHref, visibleNavigationGroups } from "../../lib/navigation";
import fs from "node:fs";

test("folder selection respects route boundaries and the longest permitted prefix", () => {
  const items = [{ href: "/settings" }, { href: "/settings/notifications" }, { href: "/vehicles" }];
  expect(currentNavigationHref("/settings/notifications/history", items)).toBe("/settings/notifications");
  expect(currentNavigationHref("/vehicles/123", items)).toBe("/vehicles");
  expect(currentNavigationHref("/vehicles-archive", items)).toBeUndefined();
});
test("folder groups contain only allowed pages and omit empty groups", () => {
  const groups = visibleNavigationGroups("staff", ["crm.manage"]);
  expect(groups.flatMap(group => group.items).some(item => item.adminOnly)).toBe(false);
  expect(groups.every(group => group.items.length > 0)).toBe(true);
  expect(groups.flatMap(group => group.items).some(item => item.href === "/invoices")).toBe(false);
});

for (const direction of ["ltr", "rtl"]) {
  test(`tabs wrap without horizontal scrolling or moving focus in ${direction}`, async ({ page }) => {
    const css = fs.readFileSync("app/folder-tabs.css", "utf8");
    await page.setContent(`<html dir="${direction}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body style="height:2000px"><input aria-label="Keep focus"><nav class="settings-tabs" style="width:280px;margin-top:100px">${Array.from({ length: 8 }, (_, i) => `<a href="#page-${i}" ${i === 7 ? 'aria-current="page"' : ""}>Page number ${i}</a>`).join("")}</nav></body></html>`);
    await page.getByRole("textbox").focus();
    const positions = await page.locator(".settings-tabs").evaluate(rail => {
      const r = rail.getBoundingClientRect();
      return [...rail.querySelectorAll("a")].map(tab => {
        const t = tab.getBoundingClientRect();
        return t.left >= r.left && t.right <= r.right && t.top >= r.top && t.bottom <= r.bottom;
      });
    });
    expect(positions).toEqual(Array(8).fill(true));
    expect(await page.locator(".settings-tabs").evaluate(rail => rail.scrollWidth <= rail.clientWidth)).toBe(true);
    await expect(page.getByRole("textbox")).toBeFocused();
    expect(await page.evaluate(() => scrollY)).toBe(0);
  });
}
