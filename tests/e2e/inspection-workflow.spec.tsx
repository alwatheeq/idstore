import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { checklistProgress, isMaintenanceCheck, recommendedIds, suggestedProblemGroups, type CheckDefinition, type CheckTask, type InspectionWorkspace } from "../../lib/inspection-workflow";
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
const { InspectionResultPicker } = loadReactSource(path.resolve("components/inspection-result-picker.tsx")) as typeof import("../../components/inspection-result-picker");

for (const locale of ["en", "ar"] as const) {
  for (const width of [320, 900]) {
    test(`inspection result icons are touch-friendly and accessible in ${locale} at ${width}px`, async ({ page, isMobile }) => {
      await page.setViewportSize({ width, height: 900 });
      const markup = renderToStaticMarkup(React.createElement(UiLocaleProvider, { initialLocale: locale } as React.ComponentProps<typeof UiLocaleProvider>,
        React.createElement(InspectionResultPicker, { value: "", onChange: () => {} })));
      const css = fs.readFileSync("app/globals.css", "utf8") + fs.readFileSync("app/apple.css", "utf8");
      await page.setContent(`<html lang="${locale}" dir="${locale === "ar" ? "rtl" : "ltr"}"><head><title>Inspection test</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body><main style="padding:16px"><form><fieldset class="iw-fields">${markup}</fieldset></form></main></body></html>`);
      const radios = page.getByRole("radio");
      await expect(radios).toHaveCount(4);
      await expect(page.locator('input:checked')).toHaveCount(0);
      expect(await page.locator("form").evaluate(form => (form as HTMLFormElement).checkValidity())).toBe(false);
      const sizes = await page.locator(".iw-result-choice").evaluateAll(labels => labels.map(label => {
        const r = label.getBoundingClientRect(); return { width: r.width, height: r.height, right: r.right };
      }));
      expect(sizes.every(size => size.width >= 100 && size.height >= 64 && size.right <= width)).toBe(true);
      expect(new Set(sizes.map(size => Math.round(size.height))).size).toBe(1);
      const pass = page.getByRole("radio", { name: inspectionText("pass", locale), exact: true });
      const fail = page.getByRole("radio", { name: inspectionText("fail", locale), exact: true });
      if (isMobile) await pass.tap(); else await pass.click();
      await expect(pass).toBeChecked();
      expect(await page.locator("form").evaluate(form => new FormData(form as HTMLFormElement).get("result"))).toBe("pass");
      await fail.focus(); await page.keyboard.press("Space");
      await expect(fail).toBeChecked(); await expect(pass).not.toBeChecked();
      expect(await page.locator(".iw-choice-pass .iw-choice-icon").evaluate(el => getComputedStyle(el).color)).toBe("rgb(22, 115, 68)");
      expect(await page.locator(".iw-choice-fail .iw-choice-icon").evaluate(el => getComputedStyle(el).color)).toBe("rgb(180, 35, 44)");
      await page.keyboard.press("ArrowDown");
      await expect(page.getByRole("radio", { name: inspectionText("inconclusive", locale), exact: true })).toBeChecked();
      const audit = await new AxeBuilder({ page }).analyze();
      expect(audit.violations.filter(v => ["serious", "critical"].includes(v.impact ?? ""))).toEqual([]);
      await page.locator(".iw-fields").evaluate(el => (el as HTMLFieldSetElement).disabled = true);
      for (const radio of await radios.all()) await expect(radio).toBeDisabled();
    });
  }
}

const check: CheckDefinition = { id: "check-1", code: "EV_PORT", organization_id: null, vehicle_model_id: null, category: "charging", label_en: "Charge-port condition", label_ar: "حالة منفذ الشحن", is_required: false, rules: { groups: ["charging"] }, recommended: true, eligible: true, reason: "complaint" };
function workspace(stage: "assign" | "select" | "record"): InspectionWorkspace {
  return { inspection: { id: "inspection-1", status: "in_progress", technician_id: "tech-1", checklist_generated_at: stage === "record" ? "2026-09-06T10:00:00Z" : null, completed_at: null, review_note: null, assignment: stage === "assign" ? {} : { odometer_km: "50000", complaint: "Charging slowly", groups: ["charging"] } },
    vehicle: { id: "vehicle-1", vin: "WVWZZZTEST00000001", model_year: 2024, registration_no: "TEST-1", odometer_km: 50000, complaint: "Charging slowly", model: { name: "ID.4", market: "JO" } }, technicians: [{ id: "tech-1", name: "Test technician" }], catalog: [check], tasks: stage === "record" ? [{ id: "task-1", sequence: 1, definition_id: check.id, snapshot: check, attempts: [] }] : [], can_record: true, can_manage: true, can_review: true };
}
test("selection excludes specialists and previously generated checks and deduplicates", () => {
  expect(recommendedIds([check, check, { ...check, id: "hv", eligible: false }, { ...check, id: "optional", recommended: false }])).toEqual([check.id]);
  expect(recommendedIds([check], [check.id])).toEqual([]);
});

test("admin on-behalf controls and attribution are bilingual; unrelated staff remain read-only", () => {
  for (const locale of ["en", "ar"] as const) {
    const render = (data: InspectionWorkspace) => renderToStaticMarkup(React.createElement(UiLocaleProvider, { initialLocale: locale } as React.ComponentProps<typeof UiLocaleProvider>,
      React.createElement(InspectionWorkflow, { saveAction: async () => ({ success: true }), data })));
    const admin = { ...workspace("record"), can_reassign: true, recording_on_behalf: true };
    expect(render(admin)).toContain(inspectionText("onBehalfNotice", locale));
    expect(render(admin)).toContain("Test technician");
    expect(render(admin)).toContain('aria-expanded="false"');
    const staff = render({ ...admin, can_record: false, can_review: false, can_reassign: false, recording_on_behalf: false });
    expect(staff).toContain(inspectionText("onlyTech", locale));
    expect(staff).not.toContain('aria-expanded="false"');
  }
});

test("software version check is bilingual, selectable and never pre-passed", () => {
  const software: CheckDefinition = { ...check, id: "software-check", code: "EV_SOFTWARE_UPDATE", category: "electronics", label_en: "Software version & update availability", label_ar: "فحص إصدار البرمجيات والتحديثات المتاحة", rules: { groups: ["general"], baseline: true }, reason: "baseline" };
  expect(isMaintenanceCheck(software)).toBe(true);
  expect(recommendedIds([software])).toEqual([software.id]);
  expect(recommendedIds([software], [software.id])).toEqual([]);
  const task = { id: "software-task", definition_id: software.id, sequence: 1, snapshot: software, attempts: [] };
  expect(checklistProgress([task]).completed).toBe(0);
  for (const locale of ["en", "ar"] as const) {
    const markup = renderToStaticMarkup(React.createElement(UiLocaleProvider, { initialLocale: locale } as React.ComponentProps<typeof UiLocaleProvider>,
      React.createElement(InspectionWorkflow, { saveAction: async () => ({ success: true }), data: { ...workspace("select"), catalog: [software] } })));
    expect(markup).toContain(locale === "ar" ? software.label_ar : "Software version &amp; update availability");
    expect(markup).toContain('type="checkbox"');
    expect(markup).not.toContain('checked=""');
  }
});

test("retired inspection fields are absent from forms, catalog and result history", () => {
  const source = fs.readFileSync("components/inspection-workflow.tsx", "utf8");
  for (const field of ["measurement", "unit", "criteria", "evidence", "rule.criteria", "rule.unit", "rule.evidence_required"]) {
    expect(source).not.toContain(`name="${field}"`);
  }
  for (const locale of ["en", "ar"] as const) {
    const data = workspace("record");
    data.tasks[0].attempts = [{ id: "attempt-1", attempt: 1, result: "pass", inspection_item_id: null, recorded_at: "2026-09-08T00:00:00Z", actor_name: "Test admin", details: { finding: "Retained finding", measurement: "HIDDEN_MEASUREMENT", unit: "HIDDEN_UNIT", criteria: "HIDDEN_CRITERIA", evidence: "HIDDEN_REFERENCE" } }];
    const markup = renderToStaticMarkup(React.createElement(UiLocaleProvider, { initialLocale: locale } as React.ComponentProps<typeof UiLocaleProvider>,
      React.createElement(InspectionWorkflow, { saveAction: async () => ({ success: true }), data })));
    expect(markup).toContain("Retained finding");
    expect(markup).not.toContain("HIDDEN_");
  }
});
test("maintenance scope excludes specialist definitions without changing saved evidence", () => {
  expect(isMaintenanceCheck(check)).toBe(true);
  for (const rules of [{ capability: "hv" }, { capability: "soh" }, { qualification: "HV_TECHNICIAN" }]) {
    expect(isMaintenanceCheck({ rules })).toBe(false);
  }
  const saved = { ...check, rules: { capability: "hv" } };
  const markup = renderToStaticMarkup(React.createElement(UiLocaleProvider, { initialLocale: "en" } as React.ComponentProps<typeof UiLocaleProvider>,
    React.createElement(InspectionWorkflow, { saveAction: async () => ({ success: true }), data: {
      ...workspace("record"), tasks: [{ id: "legacy", definition_id: saved.id, snapshot: saved, sequence: 1, attempts: [] }],
    } })));
  expect(markup).toContain("Outside maintenance scope");
  expect(markup).toContain(saved.label_en);
  expect(markup).not.toContain('aria-expanded="false"');
});

test("specialist checks are absent from selection and admin catalog", () => {
  const specialist = { ...check, id: "specialist", code: "SPECIALIST_ONLY", label_en: "Specialist-only operation", rules: { capability: "hv" }, eligible: true };
  for (const content of [
    React.createElement(InspectionCatalog, { saveAction: async () => ({ success: true }), checks: [check, specialist], models: [] }),
    React.createElement(InspectionWorkflow, { saveAction: async () => ({ success: true }), data: { ...workspace("select"), catalog: [check, specialist] } }),
  ]) {
    const markup = renderToStaticMarkup(React.createElement(UiLocaleProvider, { initialLocale: "en" } as React.ComponentProps<typeof UiLocaleProvider>, content));
    expect(markup).toContain(check.label_en);
    expect(markup).not.toContain(specialist.label_en);
    expect(markup).not.toContain('value="hv"');
    expect(markup).not.toContain('name="rule.qualification"');
  }
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
