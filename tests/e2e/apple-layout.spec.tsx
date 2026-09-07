import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import { test, expect } from "@playwright/test";
import type { CurrentStaff } from "../../lib/auth/session";
import { Users } from "lucide-react";

// Render the actual shell without production authentication or customer writes.
const runtimeRequire = createRequire(path.resolve("package.json"));
const cache = new Map<string, { exports: unknown }>();
function load(filename: string): unknown {
  if (cache.has(filename)) return cache.get(filename)!.exports;
  const loaded = { exports: {} }; cache.set(filename, loaded);
  const output = ts.transpileModule(fs.readFileSync(filename,"utf8"), { compilerOptions: { jsx:ts.JsxEmit.ReactJSX, module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022, esModuleInterop:true } }).outputText;
  const requireSource = (specifier: string): unknown => {
    if (specifier === "@/app/(app)/work-orders/item-actions") return { addOrderItem: async () => ({ error: "" }) };
    if (specifier === "@/app/(app)/catalog/actions") return { createSimpleService: async () => ({ error: "" }) };
    if (specifier === "@/app/(app)/inspections/actions") return { selectInspectionServices: async () => ({ error: "", success: true }) };
    if (specifier === "next/navigation") return { usePathname: () => "/vehicles", useRouter: () => ({ refresh() {} }) };
    if (!specifier.startsWith("@/") && !specifier.startsWith(".")) return runtimeRequire(specifier);
    const base = specifier.startsWith("@/") ? path.resolve(specifier.slice(2)) : path.resolve(path.dirname(filename),specifier);
    const file = [base,`${base}.ts`,`${base}.tsx`,`${base}.json`].find(f => fs.existsSync(f));
    if (!file) throw new Error(specifier);
    return file.endsWith(".json") ? runtimeRequire(file) : load(file);
  };
  new Function("require","module","exports",output)(requireSource,loaded,loaded.exports);
  return loaded.exports;
}
const { AppShell } = load(path.resolve("components/app-shell.tsx")) as typeof import("../../components/app-shell");
const { RecordFilters } = load(path.resolve("components/record-filters.tsx")) as typeof import("../../components/record-filters");
const { SearchFilters } = load(path.resolve("components/search-filters.tsx")) as typeof import("../../components/search-filters");
const { MetricStrip } = load(path.resolve("components/metric-strip.tsx")) as typeof import("../../components/metric-strip");
const { BranchField } = load(path.resolve("components/branch-field.tsx")) as typeof import("../../components/branch-field");
const { LabeledControl } = load(path.resolve("components/labeled-control.tsx")) as typeof import("../../components/labeled-control");
const { translatePageText } = load(path.resolve("lib/i18n/ui.ts")) as typeof import("../../lib/i18n/ui");
const { SimpleServiceForm } = load(path.resolve("components/simple-service-form.tsx")) as typeof import("../../components/simple-service-form");
const { ServiceList } = load(path.resolve("components/service-list.tsx")) as typeof import("../../components/service-list");
const { UiLocaleProvider } = load(path.resolve("components/ui-locale.tsx")) as typeof import("../../components/ui-locale");
const h = React.createElement;
const { InspectionServicesForm } = load(path.resolve("components/inspection-services-form.tsx")) as typeof import("../../components/inspection-services-form");
for (const locale of ["en", "ar"] as const) {
  for (const width of [390, 1280]) {
    test(`inspection service selection ${locale} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const css = fs.readFileSync("app/globals.css", "utf8") + fs.readFileSync("app/apple.css", "utf8");
      const services = ["Brake pads", "Brake discs", "Cabin filter"].map((name, index) => ({ id: String(index), code: `MNT-00${index}`, name, nameAr: ["فحمات الفرامل", "أقراص الفرامل", "فلتر المقصورة"][index] }));
      const markup = renderToStaticMarkup(h(UiLocaleProvider, { initialLocale: locale, children: h("section", { className: "panel", style: { margin: 16 } }, h(InspectionServicesForm, { inspectionId: "inspection", services, selectedIds: ["0"], canSelect: true })) }));
      await page.setContent(`<html lang="${locale}" dir="${locale === "ar" ? "rtl" : "ltr"}"><head><style>${css}</style></head><body>${markup}</body></html>`);
      await expect(page.getByRole("checkbox").first()).toBeChecked();
      await expect(page.getByRole("checkbox").first()).toBeDisabled();
      await page.locator(".concern-option").nth(1).click();
      await page.locator(".concern-option").nth(2).click();
      expect(await page.locator("form").evaluate(form => new FormData(form as HTMLFormElement).getAll("serviceIds"))).toEqual(["1", "2"]);
      await expect(page.getByRole("button")).toHaveText(locale === "ar" ? "إضافة الخدمات المختارة" : "Add selected services");
      await expect(page.locator("fieldset")).toContainText(locale === "ar" ? "فحمات الفرامل" : "Brake pads");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }
}
const { OrderItemForm } = load(path.resolve("components/order-item-form.tsx")) as typeof import("../../components/order-item-form");
for (const locale of ["en", "ar"] as const) {
  for (const width of [390, 1280]) {
    test(`maintenance item form ${locale} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const css = fs.readFileSync("app/globals.css", "utf8") + fs.readFileSync("app/apple.css", "utf8");
      const html = renderToStaticMarkup(h(UiLocaleProvider, { initialLocale: locale, children: null }, h("section", { className: "panel", style: { margin: 16, padding: 24 } },
        h(OrderItemForm, { orderId: "order", estimateId: "estimate", type: "part", currency: "JOD", choices: [{ id: "part", name: "Cabin filter", nameAr: "فلتر المكيف", price: 12 }] }))));
      await page.setContent(`<html lang="${locale}" dir="${locale === "ar" ? "rtl" : "ltr"}"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body>${html}</body></html>`);
      expect(await page.locator("body").evaluate(el => el.scrollWidth <= window.innerWidth)).toBe(true);
      const controls = page.locator('select, input:not([type="hidden"])');
      for (const control of await controls.all()) {
        if (!await control.isVisible()) continue;
        const box = await control.boundingBox();
        expect(box!.width).toBeGreaterThan(90);
        expect(box!.x).toBeGreaterThanOrEqual(16);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width - 16);
        await expect(control).toHaveAccessibleName(/.+/);
      }
      await expect(page.locator('input[name="unitPrice"]')).toHaveAttribute("dir", "ltr");
      await expect(page.getByRole("button", { name: locale === "ar" ? "إضافة قطعة" : "Add part", exact: true })).toBeVisible();
    });
  }
}
for (const locale of ["en", "ar"] as const) {
  for (const width of [390, 1280]) {
    test(`simple service setup ${locale} at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      const css = fs.readFileSync("app/globals.css", "utf8") + fs.readFileSync("app/apple.css", "utf8");
      const markup = renderToStaticMarkup(h(UiLocaleProvider, { initialLocale: locale, children: h("main", { className: "app-main" }, h("div", { className: "page-content" }, h("section", { className: "panel" }, h(SimpleServiceForm)), h(ServiceList, { services: [{ id: "service-1", name: "Brake inspection", nameAr: "فحص الفرامل", price: 25.5, minutes: 45, status: "published" }, { id: "legacy", name: "Existing service", nameAr: "خدمة سابقة", price: null, minutes: 60, status: "draft" }] }))) }));
      await page.setContent(`<html lang="${locale}" dir="${locale === "ar" ? "rtl" : "ltr"}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${markup}</body></html>`);
      await expect(page.locator("form input:visible")).toHaveCount(2);
      await expect(page.locator("#service-name-ar")).toBeVisible();
      await page.locator("#service-name").fill(locale === "ar" ? "فحص الفرامل" : "Brake inspection");
      expect(await page.locator("form").evaluate(form => (form as HTMLFormElement).checkValidity())).toBe(true);
      await page.locator("summary").click();
      await page.locator("#service-price").fill("25.500");
      await page.locator("#service-minutes").fill("45");
      expect(await page.locator("form").evaluate(form => (form as HTMLFormElement).checkValidity())).toBe(true);
      await page.locator("#service-minutes").fill("0");
      expect(await page.locator("form").evaluate(form => (form as HTMLFormElement).checkValidity())).toBe(false);
      await page.locator("#service-minutes").fill("45");
      await expect(page.locator("#service-name-ar")).toBeVisible();
      for (const id of ["service-price", "service-minutes"]) await expect(page.locator(`#${id}`)).toHaveCSS("direction", "ltr");
      await expect(page.locator(".simple-service-row").first()).toContainText(locale === "ar" ? "فحص الفرامل" : "Brake inspection");
      await expect(page.locator(".simple-service-row").first()).toContainText("25.500");
      await expect(page.locator(".simple-service-row").last()).toContainText(translatePageText("Not set", locale));
      await expect(page.locator(".simple-service-row").last()).toContainText(locale === "ar" ? "مسودة" : "Draft");
      await expect(page.locator(".simple-service-row a").first()).toHaveText(locale === "ar" ? "التفاصيل" : "Details");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const overflowing = await page.locator("input").evaluateAll(inputs => inputs.some(input => { const r = input.getBoundingClientRect(), p = input.closest(".panel")!.getBoundingClientRect(); return r.left < p.left || r.right > p.right; }));
      expect(overflowing).toBe(false);
      await page.screenshot({ path: testInfo.outputPath(`simple-service-${locale}-${width}.png`), fullPage: true });
    });
  }
}
for (const locale of ["en", "ar"] as const) {
  for (const width of [360, 768, 1086, 1440]) {
    test(`labeled operational controls ${locale} at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      const t = (text: string) => translatePageText(text, locale);
      const field = (text: string, type = "text") => h(LabeledControl, { label: t(text), children: h("input", { name: text, type, defaultValue: type === "file" ? undefined : type === "number" ? "12" : "Test", dir: type === "number" ? "ltr" : undefined }) });
      const select = h(LabeledControl, { label: t("Classification"), children: h("select", { name: "classification", defaultValue: "internal" }, h("option", { value: "internal" }, t("Internal"))) });
      const button = h("button", { className: "button compact", type: "submit" }, t("Save"));
      const forms = ["cash-open-form", "campaign-match-form", "assign-control", "inline-action", "send-estimate-form", "iw-toolbar", "record-target"].map(className => h("section", { className: "panel", key: className },
        h("form", { className }, field("Register code"), select, field("Counted quantity", "number"), button)));
      forms.push(h("section", { className: "panel", key: "upload" }, h("form", { className: "record-target" }, h("div", null, t("Evidence file")), select, field("Evidence file", "file"), button)));
      forms.push(h("section", { className: "panel panel-body", key: "stock" }, h("div", { className: "transfer-lines" }, h("form", null, field("Received quantity", "number"), field("Discrepancy reason"), button))));
      forms.push(h("section", { className: "panel panel-body", key: "count" }, h("div", { className: "count-list" }, h("article", null, h("form", null, h("label", null, "Part 001"), field("Counted quantity", "number"), button)))));
      const css = fs.readFileSync("app/globals.css", "utf8") + fs.readFileSync("app/apple.css", "utf8");
      const markup = renderToStaticMarkup(h("main", { className: "app-main" }, h("div", { className: "page-content" }, ...forms)));
      await page.setContent(`<html lang="${locale}" dir="${locale === "ar" ? "rtl" : "ltr"}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${markup}</body></html>`);
      const failures = await page.locator(".labeled-control").evaluateAll(labels => labels.flatMap(label => {
        const input = label.querySelector("input, select") as HTMLInputElement;
        const caption = label.querySelector(".field-label")!;
        const box = input.getBoundingClientRect(), text = caption.getBoundingClientRect(), frame = label.closest(".panel")!.getBoundingClientRect();
        const style = getComputedStyle(input);
        return [
          ...(input.labels?.length ? [] : ["Missing label association"]),
          ...(Math.abs(box.height - 46) < 1 ? [] : [`Height ${box.height}`]),
          ...(text.bottom <= box.top ? [] : ["Caption overlaps control"]),
          ...(box.left >= frame.left && box.right <= frame.right ? [] : ["Control outside card"]),
          ...(style.fontSize === (innerWidth <= 780 ? "16px" : "14px") ? [] : [`Font ${style.fontSize}`]),
          ...(style.borderRadius === "10px" ? [] : [`Radius ${style.borderRadius}`]),
        ];
      }));
      expect(failures).toEqual([]);
      for (const form of await page.locator("form").all()) {
        const buttonBox = await form.locator("button").boundingBox();
        expect(buttonBox!.height).toBe(46);
        const controlBoxes = await form.locator("input,select").evaluateAll(inputs => inputs.map(input => { const r = input.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: r.height }; }));
        for (const control of controlBoxes) if (control.bottom > buttonBox!.y && control.top < buttonBox!.y + buttonBox!.height) expect(Math.abs(control.top - buttonBox!.y)).toBeLessThanOrEqual(1);
      }
      const data = await page.locator(".cash-open-form").evaluate(form => Object.fromEntries(new FormData(form as HTMLFormElement)));
      expect(data).toEqual({ "Register code": "Test", classification: "internal", "Counted quantity": "12" });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`labeled-controls-${locale}-${width}.png`), fullPage: true });
    });
  }
}
for (const locale of ["en", "ar"] as const) {
  for (const width of [360, 768, 1086, 1440]) {
    test(`scope and inline controls share sizing in ${locale} at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      const ar = locale === "ar";
      const branches = [{ id: "branch-1", city: ar ? "عمان" : "Amman", code: "AMM-01" }];
      const scope = h("section", { className: "dashboard-scope" },
        h("div", { className: "dashboard-scope-copy" }, h("div", null,
          h("strong", null, ar ? "نطاق العمل الحالي" : "Live operational scope"),
          h("small", null, ar ? "الفروع المتاحة لحسابك" : "Branches assigned to your account"))),
        h("form", { className: "scope-form", action: "/dashboard" },
          h(BranchField, { id: "scope-branch", name: "branch", label: ar ? "الفرع" : "Branch", branches, selectedBranchId: "branch-1" }),
          h("button", { className: "button", type: "submit" }, ar ? "تطبيق" : "Apply")));
      const row = (className: string) => h("form", { className, key: className },
        h("select", { "aria-label": "Status", defaultValue: "test" }, h("option", { value: "test" }, ar ? "متاح" : "Available")),
        h("button", { className: "button compact", type: "button" }, ar ? "تطبيق" : "Apply"));
      const markup = renderToStaticMarkup(h("main", { className: "app-main" },
        h("div", { className: "page-content" }, scope,
          h("section", { className: "panel panel-body" }, ...["assign-control", "inline-action", "inline-actions", "send-estimate-form", "iw-toolbar"].map(row)))));
      const css = fs.readFileSync("app/globals.css", "utf8") + fs.readFileSync("app/apple.css", "utf8");
      await page.setContent(`<html lang="${locale}" dir="${ar ? "rtl" : "ltr"}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${markup}</body></html>`);
      const label = await page.locator('label[for="scope-branch"]').boundingBox();
      const select = await page.locator("#scope-branch").boundingBox();
      const button = await page.locator(".scope-form button").boundingBox();
      expect(select!.height).toBe(46);
      expect(button!.height).toBe(46);
      expect(Math.abs(select!.y - button!.y)).toBeLessThanOrEqual(1);
      expect(label!.y + label!.height).toBeLessThan(select!.y);
      await expect(page.locator("#scope-branch")).toBeDisabled();
      await expect(page.locator("#scope-branch")).toHaveCSS("box-shadow", "none");
      expect(await page.locator(".scope-form").evaluate(form => new FormData(form as HTMLFormElement).get("branch"))).toBe("branch-1");
      for (const className of ["scope-form", "assign-control", "inline-action", "inline-actions", "send-estimate-form", "iw-toolbar"]) {
        const measurements = await page.locator(`.${className} select, .${className} button`).evaluateAll(elements => elements.map(element => {
          const style = getComputedStyle(element); const rect = element.getBoundingClientRect();
          return { height: rect.height, y: rect.y, fontSize: style.fontSize, radius: style.borderRadius };
        }));
        expect(measurements).toHaveLength(2);
        expect(measurements[0]).toEqual(measurements[1]);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`scope-${locale}-${width}.png`), fullPage: true });
    });
  }
}
function fixture(locale: "en" | "ar", role: "admin" | "staff" = "admin") {
  const ar = locale === "ar";
  const label = (en: string, arabic: string) => ar ? arabic : en;
  const staff = { role, permissionCodes: role === "staff" ? ["crm.manage"] : [], displayName:"Test Admin", selectedBranchId:"branch-1" } as CurrentStaff;
  const children = h(React.Fragment, null,
    h("header", {className:"page-header"},h("div",null,h("div",{className:"eyebrow"},label("Vehicle registry","سجل المركبات")),h("h1",null,label("VW ID vehicles","مركبات VW ID")),h("p",null,label("Vehicle details, ownership and service history.","بيانات المركبات والملكية وسجل الصيانة."))),h("div",{className:"header-actions"},h("button",{className:"button primary"},label("Add vehicle","إضافة مركبة")))),
    h("section",{className:"panel operation-form vehicle-workspace"},
      h("div",{className:"panel-header"},h("div",null,h("div",{className:"panel-title"},label("Vehicle record · ID.4","سجل المركبة · ID.4")),h("div",{className:"panel-subtitle"},label("Technical details","البيانات الفنية")))),
      h("nav",{className:"customer-tabs vehicle-tabs"},...[label("Technical profile","الملف الفني"),label("Mileage","قراءات العداد"),label("Ownership","الملكية"),label("Service history","سجل الصيانة")].map((text,i)=>h("a",{key:text,href:"#",className:`customer-tab ${i===0?"active":""}`},text))),
      h("form",{className:"form-grid panel-body"},
        ...[label("Vehicle color","لون المركبة"),label("Software version","إصدار البرنامج")].map((text,i)=>h("div",{key:text,className:"form-field"},h("label",{htmlFor:`field-${i}`},text),h("input",{id:`field-${i}`,defaultValue:i?"3.7":"Blue"}))),
        h("div",{className:"form-field form-span-2"},h("label",{htmlFor:"mobile-fixture"},label("Phone","الهاتف")),h("div",{className:"phone-control"},h("select",{"aria-label":"Country",defaultValue:"JO"},h("option",null,"JO")),h("input",{id:"mobile-fixture",type:"tel",defaultValue:"0790000000"}))),
        h("div",{className:"form-actions form-span-2"},h("button",{className:"button primary",type:"button"},label("Update","تحديث")))))
  );
  return renderToStaticMarkup(h(AppShell,{staff,initialLocale:locale,branches:[{id:"branch-1",code:"AMM-01",city:label("Amman","عمّان"),displayName:"Amman"}],children}));
}

for (const locale of ["en","ar"] as const) {
  for (const width of [390,768,1280]) {
    test(`shared Apple-style shell and forms ${locale} at ${width}px`, async ({page},testInfo) => {
      await page.setViewportSize({width,height:900});
      const css = fs.readFileSync("app/globals.css","utf8") + fs.readFileSync("app/apple.css","utf8");
      await page.setContent(`<html lang="${locale}" dir="${locale==="ar"?"rtl":"ltr"}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${fixture(locale)}</body></html>`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.locator(".panel-header")).toHaveCSS("background-color","rgb(240, 240, 243)");
      await expect(page.locator(".panel")).toHaveCSS("background-color","rgb(240, 240, 243)");
      await expect(page.locator("form.panel-body")).toHaveCSS("background-color","rgb(240, 240, 243)");
      await expect(page.locator("#field-0")).toHaveCSS("background-color","rgb(255, 255, 255)");
      await expect(page.locator("body")).toHaveCSS("background-color", "rgb(245, 245, 247)");
      await expect(page.locator(".button.primary").first()).toHaveCSS("background-color", "rgb(24, 54, 93)");
      await expect(page.locator(".page-header h1")).toHaveCSS("color", "rgb(17, 17, 17)");
      // Test rendered color pairs, including controls, against WCAG contrast thresholds.
      const contrasts = await page.evaluate(() => {
        const luminance = (color: string) => {
          const rgb = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(v => {
            const s = v / 255;
            return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4;
          });
          return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
        };
        const ratio = (a: string, b: string) => {
          const x = luminance(a), y = luminance(b);
          return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
        };
        const style = (selector: string) => getComputedStyle(document.querySelector(selector)!);
        const button = style(".button.primary"), nav = style(".nav-item.active"), field = style("#field-0");
        return {
          button: ratio(button.color, button.backgroundColor),
          navigation: ratio(nav.color, nav.backgroundColor),
          helper: ratio(style(".panel-subtitle").color, style(".panel-header").backgroundColor),
          sidebar: ratio(style(".nav-group summary").color, style(".sidebar").backgroundColor),
          field: ratio(field.borderTopColor, field.backgroundColor),
        };
      });
      for (const key of ["button", "navigation", "helper", "sidebar"] as const) expect(contrasts[key], key).toBeGreaterThanOrEqual(4.5);
      expect(contrasts.field).toBeGreaterThanOrEqual(3);
      await expect(page.locator(".phone-control")).toHaveCSS("direction","ltr");
      const overflowing = await page.locator(".form-field input,.form-field select").evaluateAll(elements => elements.filter(el=> {const r=el.getBoundingClientRect();return r.left<0||r.right>innerWidth||r.width<80;} ).length);
      expect(overflowing).toBe(0);
      if(width<=780) {
        await expect(page.locator(".sidebar")).not.toBeVisible();
        await expect(page.locator(".touch-dock")).toBeVisible();
        await expect(page.locator("#mobile-fixture")).toHaveCSS("font-size","16px");
      } else await expect(page.locator(".sidebar")).toBeVisible();
      await page.screenshot({path:testInfo.outputPath(`clear-${locale}-${width}.png`),fullPage:true});
    });
  }
}

test("mobile shortcuts respect staff permissions", async ({page}) => {
  await page.setContent(fixture("ar","staff"));
  await expect(page.locator('.touch-dock a[href="/appointments"]')).toHaveCount(0);
  await expect(page.locator('.touch-dock a[href^="/work-orders"]')).toHaveCount(0);
  await expect(page.locator('.nav-item[href="/vehicles"]')).toHaveCount(1);
});

for (const locale of ["en", "ar"] as const) {
  for (const width of [390, 768, 1086, 1440]) {
    test(`shared toolbar, metric and narrow-card alignment ${locale} at ${width}px`, async ({ page }, testInfo) => {
      const ar = locale === "ar";
      const label = (en: string, arabic: string) => ar ? arabic : en;
      const field = (id: string, text: string) => h("div", { className: "form-field", key: id }, h("label", { htmlFor: id }, text), h("input", { id }));
      const children = h(React.Fragment, null,
        h(MetricStrip, { metrics: ["Active customers", "Fleet accounts", "Registered vehicles", "Mobile complete"].map((name, i) => ({ label: name, value: i === 3 ? "100%" : "1", note: name, icon: Users })) }),
        h("section", { className: "panel", id: "filter-panel" }, h("div", { className: "panel-body" }, h(RecordFilters, { action: "/customers", label: label("Customer type", "نوع العميل"), placeholder: label("Search by name or phone", "البحث بالاسم أو رقم الهاتف"), options: [] }))),
        h("section", { className: "panel" }, h("div", { className: "panel-body" }, h(SearchFilters, { placeholder: label("Search records", "بحث في السجلات"), filters: [label("All branches", "جميع الفروع")] }))),
        h("div", { className: "finance-control-grid" }, ...[0, 1].map(index => h("section", { className: "panel", key: index },
          h("div", { className: "panel-header" }, h("div", null, h("div", { className: "panel-title" }, label("Record details", "بيانات السجل")))),
          h("form", { className: "form-grid panel-body narrow-form" }, field(`narrow-${index}-0`, label("Reference", "المرجع")), field(`narrow-${index}-1`, label("Additional information", "معلومات إضافية")), h("div", { className: "form-actions form-span-2" }, h("button", { type: "button", className: "button primary" }, label("Save", "حفظ"))))))),
      );
      const staff: CurrentStaff = { userId: "test-admin", organizationId: "test-org", branchIds: ["branch-1"], role: "admin", permissionCodes: [], displayName: "Test Admin", selectedBranchId: "branch-1" };
      let markup = renderToStaticMarkup(h(AppShell, { staff, initialLocale: locale, branches: [], children }));
      // LocalizedContent translates these server-rendered toolbar strings after hydration in the app.
      if (ar) markup = markup.replaceAll(">Search<", ">بحث<").replaceAll(">Reset filters<", ">مسح الفلاتر<").replaceAll(">All<", ">الكل<");
      await page.setViewportSize({ width, height: 1000 });
      await page.setContent(`<html lang="${locale}" dir="${ar ? "rtl" : "ltr"}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${fs.readFileSync("app/globals.css", "utf8") + fs.readFileSync("app/apple.css", "utf8")}</style></head><body>${markup}</body></html>`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const boxes = await page.locator(".record-filters input,.record-filters select,.record-filter-actions .button").evaluateAll(elements => elements.map(el => {
        const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: r.height, left: r.left, right: r.right };
      }));
      for (const box of boxes) expect(box.height).toBeCloseTo(46, 0);
      expect(boxes[2].top).toBeCloseTo(boxes[3].top, 0);
      const panelWidth = (await page.locator("#filter-panel").boundingBox())!.width;
      if (panelWidth > 702) for (const box of boxes) expect(box.bottom).toBeCloseTo(boxes[0].bottom, 0);
      else if (panelWidth > 442) expect(boxes[1].bottom).toBeCloseTo(boxes[2].bottom, 0);
      else {
        expect(boxes[1].top).toBeGreaterThan(boxes[0].bottom);
        expect(boxes[2].top).toBeGreaterThan(boxes[1].bottom);
        expect(boxes[2].right - boxes[2].left).toBeCloseTo(boxes[3].right - boxes[3].left, 0);
      }
      const legacyHeights = await page.locator(".filter-row input,.filter-row select").evaluateAll(elements => elements.map(el => el.getBoundingClientRect().height));
      expect(legacyHeights).toEqual([46, 46]);
      const metrics = await page.locator(".metric").evaluateAll(elements => elements.map(el => el.getBoundingClientRect().height));
      expect(Math.max(...metrics) - Math.min(...metrics)).toBeLessThan(1);
      await expect(page.locator(".metric-value").first()).toHaveCSS("text-align", ar ? "right" : "left");
      await expect(page.locator(".metric-value").first()).toHaveCSS("direction", "ltr");
      for (const form of await page.locator(".narrow-form").all()) {
        const inputs = await form.locator("input").evaluateAll(elements => elements.map(el => ({ top: el.getBoundingClientRect().top, width: el.getBoundingClientRect().width })));
        expect(inputs[1].top).toBeGreaterThan(inputs[0].top);
        expect(inputs[0].width).toBeCloseTo(inputs[1].width, 0);
      }
      await page.screenshot({ path: testInfo.outputPath(`alignment-${locale}-${width}.png`), fullPage: true });
    });
  }
}
