import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { NextRequest } from "next/server";
import { GET as getReadiness } from "../../app/api/readiness/route";
import { renderServiceDocument } from "../../lib/documents/service-document";
import { updateSession } from "../../lib/supabase/proxy";
import { visibleNavigationGroups } from "../../lib/navigation";
import { translatePageText } from "../../lib/i18n/ui";

test("actions stay concise in English and Arabic", () => {
  expect(translatePageText("Record refund", "en")).toBe("Refund");
  expect(translatePageText("Record refund", "ar")).toBe("استرداد");
  expect(translatePageText("Create branch", "en")).toBe("Add branch");
  expect(translatePageText("High-voltage service", "ar")).toBe("خدمة الجهد العالي");
  expect(translatePageText("Roles & permissions", "ar")).toBe("الأدوار والصلاحيات");
  expect(translatePageText("Customer records", "ar")).toBe("سجلات العملاء");
});

test("staff navigation follows assigned functional permissions", () => {
  const groups = visibleNavigationGroups("staff", ["crm.manage", "job.perform"]);
  const routes = groups.flatMap((group) => group.items.map((item) => item.href));

  expect(routes).toContain("/dashboard");
  expect(routes).toContain("/customers");
  expect(routes).toContain("/vehicles");
  expect(routes).toContain("/diagnostics");
  expect(routes).toContain("/records");
  expect(routes).not.toContain("/staff");
  expect(routes).not.toContain("/settings/access");
  expect(routes).not.toContain("/invoices");
});

test("admins retain the complete navigation surface", () => {
  const routes = visibleNavigationGroups("admin", []).flatMap((group) => group.items.map((item) => item.href));
  expect(routes).toContain("/staff");
  expect(routes).toContain("/branches");
  expect(routes).toContain("/finance-control");
  expect(routes).toContain("/settings/access");
});

test("missing Supabase configuration fails closed", async () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  try {
    const response = await updateSession(new NextRequest("http://127.0.0.1:3100/dashboard"));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") ?? "http://invalid");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/dashboard");

    const healthResponse = await updateSession(new NextRequest("http://127.0.0.1:3100/api/health"));
    expect(healthResponse.status).toBe(200);
    expect(healthResponse.headers.get("location")).toBeNull();

    expect(getReadiness().status).toBe(503);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.invalid";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test_configuration_only";
    expect(getReadiness().status).toBe(200);
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;

    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = previousKey;
  }
});

test("deployment health endpoint is public and non-cacheable", async ({ request }) => {
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(health.headers()["cache-control"]).toContain("no-store");
  expect(await health.json()).toMatchObject({ status: "ok", service: "idstore" });
});

test("service documents render bilingual print-safe content", () => {
  const html = renderServiceDocument({
    type: "invoice",
    number: "TEST-INV-1",
    status: "posted",
    currency: "JOD",
    subtotal: 10,
    discount: 0,
    tax: 1.6,
    total: 11.6,
    paid: 0,
    issued_at: "2026-09-05T12:00:00Z",
    repair_order: "TEST-RO-1",
    seller: { organization_name: "IDstore", branch_name: "Amman", city: "Amman" },
    buyer: { customer_name: "Test & <عميل>" },
    vehicle: { vin: "WVWZZZTEST", model: "ID.4" },
    lines: [{ line_no: 1, line_type: "labor", description: "Inspection <فحص>", quantity: 1, unit_price: 10, discount: 0, tax_rate: 16, tax: 1.6, total: 11.6 }],
  });

  expect(html).toContain("فاتورة ضريبية");
  expect(html).toContain("Test &amp; &lt;عميل&gt;");
  expect(html).toContain("Inspection &lt;فحص&gt;");
  expect(html).toContain("@media print");
});

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
  for (const route of ["/dashboard", "/records", "/finance-control", "/quality-campaigns", "/reports", "/search", "/governance", "/settings/access", "/portal", "/api/documents/invoice/00000000-0000-0000-0000-000000000000"]) {
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

test("Arabic preference renders translated RTL login", async ({ context, page }) => {
  await context.addCookies([{ name: "idstore_locale", value: "ar", domain: "127.0.0.1", path: "/", sameSite: "Lax" }]);
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { name: "أهلاً بعودتك" })).toBeVisible();
  await expect(page.getByLabel("رقم الهاتف")).toBeVisible();
  await expect(page.getByLabel("رقم سري من 6 أرقام")).toBeVisible();
  await expect(page.getByRole("button", { name: "دخول" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});
