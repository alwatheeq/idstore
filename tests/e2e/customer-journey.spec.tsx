import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import { test, expect } from "@playwright/test";
import { translatePageText, translateStatus } from "../../lib/i18n/ui";
import { matchesRecordSearch, normalizeRecordSearch } from "../../lib/record-search";

const runtimeRequire = createRequire(path.resolve("package.json"));
let locale: "en" | "ar" = "en";
let queryResult: { data: unknown; error: unknown };
let filters: [string, string][] = [];
let tableResults: Record<string, { data: unknown; error: unknown }> | undefined;
let queries: { table: string; filters: [string, unknown][] }[] = [];
let signedPaths: string[] = [];
const cache = new Map<string, { exports: unknown }>();
function load(filename: string): unknown {
  if (cache.has(filename)) return cache.get(filename)!.exports;
  const loaded = { exports: {} }; cache.set(filename, loaded);
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const requireSource = (specifier: string): unknown => {
    if (specifier === "@/components/ui-locale") return { useUiLocale: () => ({ locale, pageText: (text: string) => translatePageText(text, locale), statusText: (text: string) => translateStatus(text, locale) }) };
    if (specifier === "@/lib/supabase/server") return { createClient: async () => ({ from: (table: string) => {
      const query = { table, filters: [] as [string, unknown][] }; queries.push(query);
      const result = () => tableResults?.[table] ?? queryResult;
      const builder = { select: () => builder, eq: (key: string, value: string) => { filters.push([key, value]); query.filters.push([key,value]); return builder; },
        in: (key: string, value: string[]) => { query.filters.push([key,value]); return builder; }, neq: () => builder,
        order: async () => result(), then: (resolve: (value: unknown) => void) => Promise.resolve(result()).then(resolve) }; return builder;
    }, storage: { from: () => ({ createSignedUrl: async (objectPath: string) => { signedPaths.push(objectPath); return { data: { signedUrl: `https://example.test/${objectPath}` } }; } }) } }) };
    if (!specifier.startsWith("@/") && !specifier.startsWith(".")) return runtimeRequire(specifier);
    const base = specifier.startsWith("@/") ? path.resolve(specifier.slice(2)) : path.resolve(path.dirname(filename), specifier);
    const file = [base, `${base}.ts`, `${base}.tsx`, `${base}.json`].find(f => fs.existsSync(f));
    if (!file) throw new Error(specifier);
    return file.endsWith(".json") ? runtimeRequire(file) : load(file);
  };
  new Function("require", "module", "exports", output)(requireSource, loaded, loaded.exports);
  return loaded.exports;
}
const { IntakeIdentityFields } = load(path.resolve("components/intake-identity-fields.tsx")) as typeof import("../../components/intake-identity-fields");
const { CustomerServiceHistory } = load(path.resolve("components/customer-service-history.tsx")) as typeof import("../../components/customer-service-history");
const { RecordDocuments } = load(path.resolve("components/record-documents.tsx")) as typeof import("../../components/record-documents");
const { CustomerVehicles } = load(path.resolve("components/customer-vehicles.tsx")) as typeof import("../../components/customer-vehicles");
const { RecordFilters } = load(path.resolve("components/record-filters.tsx")) as typeof import("../../components/record-filters");
test.beforeEach(() => { tableResults = undefined; queries = []; signedPaths = []; });
const vehicles = [
  { id: "vehicle-1", vin: null, registration_no: "TEST-1", model: { name: "ID.4" }, customerIds: ["customer-1"] },
  { id: "vehicle-2", vin: "WVWZZZE1ZNP012418", registration_no: null, model: { name: "ID.3" }, customerIds: ["customer-2"] },
];
const customers = [{ id: "customer-1", display_name: "Test customer" }, { id: "customer-2", display_name: "Other customer" }];
const visit = {
  id: "order-1", ro_number: "AMM-RO-0001", status: "closed", opened_at: "2026-09-06T10:00:00Z", odometer_km: 50000, customer_concern: "Charging issue", branch: { city: "Amman", code: "AMM" }, vehicle: vehicles[0],
  estimate_versions: [{ id: "quote-1", version_no: 1, status: "approved", currency: "JOD", grand_total: 100 }],
  invoices: [{ id: "invoice-1", invoice_number: "INV-001", status: "partially_paid", currency: "JOD", grand_total: 100, paid_total: 25, payment_allocations: [{ amount: 25, payment: { id: "pay-1", receipt_number: "RCPT-001", status: "received", method: "cash", received_at: "2026-09-06T10:00:00Z" } }] }],
};

for (const language of ["en", "ar"] as const) {
  test(`prefilled intake filters vehicles and fits mobile in ${language}`, async ({ page }) => {
    locale = language;
    const markup = renderToStaticMarkup(React.createElement("form", { className: "form-grid panel-body" }, React.createElement(IntakeIdentityFields, { customers, vehicles, initialCustomerId: "customer-1", initialVehicleId: "vehicle-1" })));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.setContent(`<html dir="${locale === "ar" ? "rtl" : "ltr"}"><head><style>${fs.readFileSync("app/globals.css", "utf8")}${fs.readFileSync("app/apple.css", "utf8")}</style></head><body>${markup}</body></html>`);
    await expect(page.locator('[name="customerId"]')).toHaveValue("customer-1");
    await expect(page.locator('[name="vehicleId"]')).toHaveValue("vehicle-1");
    await expect(page.locator('[name="vehicleId"] option[value="vehicle-2"]')).toHaveCount(0);
    await expect(page.locator('a[href="/vehicles?new=1&customer=customer-1#new-vehicle"]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator('select').evaluateAll(elements => elements.every(el => el.getBoundingClientRect().width >= 200))).toBe(true);
    if (locale === "ar") await expect(page.locator('label[for="work-customer"]')).toHaveText("العميل");
  });
}
test("forged or stale preselected vehicle is not retained", () => {
  locale = "en";
  const markup = renderToStaticMarkup(React.createElement(IntakeIdentityFields, { customers, vehicles, initialCustomerId: "customer-1", initialVehicleId: "vehicle-2" }));
  expect(markup).not.toContain('value="vehicle-2"');
  expect(markup).toContain('<option value="" selected="">Select vehicle</option>');
  expect(fs.readFileSync("app/(app)/work-orders/actions.ts", "utf8")).toContain('Link this customer to the vehicle before opening a visit.');
});
test("service history is customer-scoped, linked and shows invoice allocations", async ({ page }) => {
  locale = "ar"; filters = []; queryResult = { data: [visit], error: null };
  const markup = renderToStaticMarkup(await CustomerServiceHistory({ organizationId: "org-1", customerId: "customer-1" }));
  expect(filters).toEqual([["organization_id", "org-1"], ["customer_id", "customer-1"]]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent(`<html dir="rtl"><head><style>${fs.readFileSync("app/globals.css", "utf8")}${fs.readFileSync("app/apple.css", "utf8")}</style></head><body>${markup}</body></html>`);
  await expect(page.locator('a[href="/work-orders?order=order-1#order-order-1"]')).toHaveAttribute("dir", "ltr");
  await expect(page.locator('a[href="/estimates?estimate=quote-1#estimate-workspace"]')).toBeVisible();
  await expect(page.locator('a[href="/invoices#invoice-invoice-1"]')).toBeVisible();
  await expect(page.locator(".journey-summary")).toContainText("75.000");
  await expect(page.locator(".journey-payment")).toContainText("25.000");
  await expect(page.locator("time").first()).toHaveAttribute("dir", "ltr");
  await expect(page.locator("time").first()).toContainText("2026");
  expect(await page.locator("time").first().innerText()).toBe("06/09/2026");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test("history errors are not rendered as empty customer history", async () => {
  queryResult = { data: null, error: { message: "unavailable" } };
  const markup = renderToStaticMarkup(await CustomerServiceHistory({ organizationId: "org-1", customerId: "customer-1" }));
  expect(markup).toContain('role="alert"');
  expect(markup).not.toContain("No service visits");
});

test("vehicle financial tabs scope queries and separate quotations from invoices", async () => {
  queryResult = { data: [visit], error: null }; filters = [];
  const quotes = renderToStaticMarkup(await CustomerServiceHistory({ organizationId: "org-1", vehicleId: "vehicle-1", view: "quotes" }));
  expect(filters).toContainEqual(["vehicle_id", "vehicle-1"]);
  expect(filters).not.toContainEqual(["customer_id", "customer-1"]);
  expect(quotes).toContain("estimate=quote-1"); expect(quotes).not.toContain("invoice-invoice-1");
  const invoices = renderToStaticMarkup(await CustomerServiceHistory({ organizationId: "org-1", vehicleId: "vehicle-1", view: "invoices" }));
  expect(invoices).toContain("invoice-invoice-1"); expect(invoices).not.toContain("estimate=quote-1");
});
test("customer documents bind to customer visits, never to later vehicle ownership", async () => {
  tableResults = {
    repair_orders: { data: [{ id: "own-order", inspections: [{ id: "own-inspection" }], invoices: [{ id: "own-invoice" }] }], error: null },
    attachments: { data: [], error: null },
  };
  await RecordDocuments({ organizationId: "org-1", scope: { type: "customer", id: "customer-1" } });
  expect(queries[0].filters).toEqual([["organization_id", "org-1"], ["customer_id", "customer-1"]]);
  const attachments = queries.filter(q => q.table === "attachments");
  expect(attachments).toHaveLength(3);
  expect(attachments.every(q => q.filters.some(([key,value]) => key === "organization_id" && value === "org-1"))).toBe(true);
  expect(attachments.map(q => q.filters.find(([key]) => key === "linked_type")?.[1])).toEqual(["repair_order", "inspection", "invoice"]);
  expect(attachments[0].filters).toContainEqual(["linked_id", ["own-order"]]);
  expect(signedPaths).toHaveLength(0);
});
test("vehicle documents expose only scoped private files and a preselected upload link", async ({ page }) => {
  tableResults = { repair_orders: { data: [], error: null }, battery_health_reports: { data: [], error: null }, attachments: { data: [{ id: "file-1", bucket: "vehicle-media", object_path: "org-1/vehicle/vehicle-1/registration.pdf", mime_type: "application/pdf", size_bytes: 1200, classification: "confidential", linked_type: "vehicle", linked_id: "vehicle-1", created_at: "2026-09-06T10:00:00Z" }], error: null } };
  const markup = renderToStaticMarkup(await RecordDocuments({ organizationId: "org-1", scope: { type: "vehicle", id: "vehicle-1" } }));
  expect(queries.find(q => q.table === "attachments")?.filters).toContainEqual(["linked_id", ["vehicle-1"]]);
  expect(signedPaths).toEqual(["org-1/vehicle/vehicle-1/registration.pdf"]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent(`<html dir="rtl"><style>${fs.readFileSync("app/globals.css","utf8")}${fs.readFileSync("app/apple.css","utf8")}</style><body>${markup}</body></html>`);
  await expect(page.locator('a[href="/records?vehicle=vehicle-1#record-upload"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test("document query errors prevent signing or presenting an empty ledger", async () => {
  tableResults = { repair_orders: { data: null, error: { message: "denied" } } };
  const markup = renderToStaticMarkup(await RecordDocuments({ organizationId: "org-1", scope: { type: "customer", id: "customer-1" } }));
  expect(markup).toContain('role="alert"'); expect(signedPaths).toEqual([]);
});
test("historical vehicle links remain visible but cannot initiate a current visit", async () => {
  const vehicle = { ...vehicles[0], model_year: 2022, color: null, odometer_readings: [] };
  tableResults = { vehicle_ownerships: { data: [{ id: "link-1", valid_from: "2020-01-01", valid_to: "2021-01-01", relationship: "owner", vehicle }], error: null }, repair_orders: { data: [], error: null } };
  const markup = renderToStaticMarkup(await CustomerVehicles({ organizationId: "org-1", customerId: "customer-1" }));
  expect(markup).toContain("manage=vehicle-1"); expect(markup).not.toContain("/work-orders?new=1");
});
test("search normalizes Arabic digits and requires all search terms", () => {
  expect(normalizeRecordSearch("  ٣٤٣٣٢٢  ")).toBe("343322");
  expect(matchesRecordSearch("MOAT ٣٤٣", ["Moatasem", "343322"])).toBe(true);
  expect(matchesRecordSearch("MOAT ٩٩٩", ["Moatasem", "343322"])).toBe(false);
  expect(matchesRecordSearch("wvwz", [null, "WVWZZZE1ZNP012418"])).toBe(true);
  expect(matchesRecordSearch(["unexpected"], ["safe"])).toBe(true);
});
test("record filters submit query and facet through a shareable GET form", async ({ page }) => {
  const markup = renderToStaticMarkup(React.createElement(RecordFilters, { action: "/customers", query: "Moatasem", facet: "individual", label: "Customer type", options: [{ value: "individual", label: "Individual" }], placeholder: "Search" }));
  await page.setContent(markup);
  await expect(page.locator("form")).toHaveAttribute("method", "get");
  await expect(page.locator("form")).toHaveAttribute("action", "/customers");
  expect(await page.locator("form").evaluate(form => Object.fromEntries(new FormData(form as HTMLFormElement)))).toEqual({ q: "Moatasem", filter: "individual" });
});
