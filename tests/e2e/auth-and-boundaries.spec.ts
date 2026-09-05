import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { NextRequest } from "next/server";
import { GET as getReadiness } from "../../app/api/readiness/route";
import { updateSession } from "../../lib/supabase/proxy";

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
