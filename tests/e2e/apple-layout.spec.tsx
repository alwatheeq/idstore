import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import { test, expect } from "@playwright/test";
import type { CurrentStaff } from "../../lib/auth/session";

// Render the actual shell without production authentication or customer writes.
const runtimeRequire = createRequire(path.resolve("package.json"));
const cache = new Map<string, { exports: unknown }>();
function load(filename: string): unknown {
  if (cache.has(filename)) return cache.get(filename)!.exports;
  const loaded = { exports: {} }; cache.set(filename, loaded);
  const output = ts.transpileModule(fs.readFileSync(filename,"utf8"), { compilerOptions: { jsx:ts.JsxEmit.ReactJSX, module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022, esModuleInterop:true } }).outputText;
  const requireSource = (specifier: string): unknown => {
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
const h = React.createElement;
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
