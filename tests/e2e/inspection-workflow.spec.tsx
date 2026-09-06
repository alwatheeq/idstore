import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import { test, expect } from "@playwright/test";
import { checklistProgress, recommendedIds, suggestedProblemGroups, type CheckDefinition, type CheckTask, type InspectionWorkspace } from "../../lib/inspection-workflow";
import { inspectionCopy, inspectionText } from "../../lib/i18n/inspection";

// Playwright's TSX transform creates component-test descriptors, not React
// elements. Render the real source with TypeScript's React JSX transform.
const runtimeRequire = createRequire(path.resolve("package.json"));
const modules = new Map<string, { exports: unknown }>();
function loadReactSource(filename: string): unknown {
  if (modules.has(filename)) return modules.get(filename)!.exports;
  const loadedModule = { exports: {} }; modules.set(filename, loadedModule);
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const localRequire = (specifier: string) => {
    if (!specifier.startsWith("@/") && !specifier.startsWith(".")) return runtimeRequire(specifier);
    const base = specifier.startsWith("@/") ? path.resolve(specifier.slice(2)) : path.resolve(path.dirname(filename), specifier);
    const resolved = [base, `${base}.ts`, `${base}.tsx`, `${base}.json`].find(file => fs.existsSync(file));
    if (!resolved) throw new Error(`Missing fixture dependency: ${specifier}`);
    return resolved.endsWith(".json") ? runtimeRequire(resolved) : loadReactSource(resolved);
  };
  new Function("require", "module", "exports", output)(localRequire, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}
const { UiLocaleProvider } = loadReactSource(path.resolve("components/ui-locale.tsx")) as typeof import("../../components/ui-locale");
const { InspectionCatalog, InspectionWorkflow } = loadReactSource(path.resolve("components/inspection-workflow.tsx")) as typeof import("../../components/inspection-workflow");

const check: CheckDefinition = { id: "check-1", code: "EV_PORT", organization_id: null, vehicle_model_id: null, category: "charging", label_en: "Charge-port condition", label_ar: "حالة منفذ الشحن", is_required: false, rules: { groups: ["charging"] }, recommended: true, eligible: true, reason: "complaint" };
function workspace(stage: "assign" | "select" | "record"): InspectionWorkspace {
  return { inspection: { id: "inspection-1", status: "in_progress", technician_id: "tech-1", checklist_generated_at: stage === "record" ? "2026-09-06T10:00:00Z" : null, completed_at: null, review_note: null, assignment: stage === "assign" ? {} : { odometer_km: "50000", complaint: "Charging slowly", groups: ["charging"] } },
    vehicle: { id: "vehicle-1", vin: "WVWZZZTEST00000001", model_year: 2024, registration_no: "TEST-1", odometer_km: 50000, complaint: "Charging slowly", model: { name: "ID.4", market: "JO" } }, technicians: [{ id: "tech-1", name: "Test technician" }], catalog: [check], tasks: stage === "record" ? [{ id: "task-1", sequence: 1, definition_id: check.id, snapshot: check, attempts: [] }] : [], can_record: true, can_manage: true, can_review: true };
}
test("selection excludes specialists and previously generated checks and deduplicates", () => {
  expect(recommendedIds([check, check, { ...check, id: "hv", eligible: false }, { ...check, id: "optional", recommended: false }])).toEqual([check.id]);
  expect(recommendedIds([check], [check.id])).toEqual([]);
});
test("pending and inconclusive checks remain outstanding; retests preserve originals", () => {
  const tasks = ["pending", "pass", "fail", "inconclusive", "not_applicable", "exception"].map((result, i) => ({ id: String(i), definition_id: check.id, sequence: i + 1, snapshot: check, attempts: result === "pending" ? [] : [{ id: String(i), inspection_item_id: null, attempt: 1, result, details: {}, recorded_at: "2026-09-06T10:00:00Z", actor_name: "Test" }] })) as CheckTask[];
  const progress = checklistProgress(tasks);
  expect(progress).toMatchObject({ total: 6, completed: 4 });
  expect(progress.outstanding).toHaveLength(2); expect(progress.failed).toHaveLength(1);
  expect(tasks[2].attempts[0].result).toBe("fail");
});
test("complaint categories are suggested in English and Arabic", () => {
  expect(suggestedProblemGroups("Charging issue; reduced driving range")).toEqual(["general", "charging", "range"]);
  expect(suggestedProblemGroups("مشكلة في الشحن والفرامل")).toEqual(["general", "charging", "brakes"]);
});
test("inspection dictionary has Arabic text for every typed key", () => {
  for (const [key, labels] of Object.entries(inspectionCopy)) {
    expect(labels[0], key).not.toBe(""); expect(labels[1], key).toMatch(/[\u0600-\u06ff]/);
  }
  expect(inspectionText("inconclusive", "ar")).toBe("غير حاسم");
});
for (const locale of ["en", "ar"] as const) {
  for (const stage of ["assign", "select", "record", "catalog"] as const) {
    test(`inspection ${stage} layout remains contained in ${locale}`, async ({ page }, testInfo) => {
      // Render real components with synthetic data. No auth or customer writes.
      const saveAction = async () => ({ success: true });
      const content = stage === "catalog" ? React.createElement(InspectionCatalog, { saveAction, checks: [check], models: [{ id: "model-1", name: "ID.4", model_code: "ID4", market: "JO" }] }) : React.createElement(InspectionWorkflow, { saveAction, data: workspace(stage) });
      const markup = renderToStaticMarkup(React.createElement(UiLocaleProvider, { initialLocale: locale } as React.ComponentProps<typeof UiLocaleProvider>, content));
      const css = fs.readFileSync("app/globals.css", "utf8") + fs.readFileSync("app/apple.css", "utf8");
      const width = testInfo.project.name.startsWith("mobile") ? 380 : 970;
      await page.setContent(`<html lang="${locale}" dir="${locale === "ar" ? "rtl" : "ltr"}"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body style="margin:0;padding:8px"><main style="max-width:${width}px;margin:auto">${markup}</main></body></html>`);
      if (stage === "catalog") await expect(page.getByText(inspectionText("catalog", locale), { exact: true })).toBeVisible();
      else await expect(page.locator(".iw-steps button[aria-current]")).toContainText(inspectionText(stage, locale));
      const overflow = await page.locator("input:not([type=hidden]), select, textarea").evaluateAll(elements => elements.filter(element => {
        const rect = element.getBoundingClientRect(); const parent = element.parentElement!.getBoundingClientRect();
        return rect.width > parent.width + 2 || rect.left < -1 || rect.right > document.documentElement.clientWidth + 1;
      }).map(element => element.getAttribute("name")));
      expect(overflow).toEqual([]);
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
      if (stage === "assign") await expect(page.locator('input[name="odometer_km"]')).toHaveAttribute("dir", "ltr");
      await page.screenshot({ path: testInfo.outputPath(`${stage}-${locale}.png`), fullPage: true });
    });
  }
}
