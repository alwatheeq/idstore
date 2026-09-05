import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("unauthenticated visitors are routed to the mobile login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login(?:\?.*)?$/);
  await expect(page.getByRole("heading", { name: /Welcome back/i })).toBeVisible();
  await expect(page.getByLabel(/Country and calling code/i)).toBeVisible();
  await expect(page.getByLabel(/Mobile number/i)).toBeVisible();
  await expect(page.getByLabel(/6-digit PIN/i)).toBeVisible();
});

test("login blocks malformed PINs before any authentication request", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/Mobile number/i).fill("790000000");
  await page.getByLabel(/6-digit PIN/i).fill("123");
  await page.getByRole("button", { name: /Sign in/i }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel(/6-digit PIN/i)).toHaveJSProperty("validity.valid", false);
});

test("protected staff and customer routes do not leak content", async ({ page }) => {
  for (const route of ["/dashboard", "/records", "/finance-control", "/quality-campaigns", "/reports", "/search", "/governance", "/portal"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login(?:\?.*)?$/);
  }
});

test("login has no serious accessibility violations", async ({ page }) => {
  await page.goto("/login");
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);
});

test("mobile login does not overflow horizontally", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Mobile-only assertion");
  await page.goto("/login");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});
