import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import { test, expect } from "@playwright/test";
import { servicePrice, simpleServiceValues } from "../../lib/service-catalog";

function form(values: Record<string, string>) { const result = new FormData(); for (const [key, value] of Object.entries(values)) result.set(key, value); return result; }
const valid = { name: "Brake inspection", nameAr: "فحص الفرامل", customerPrice: "25.500", estimatedMinutes: "45" };
function actionFixture(role = "admin", failure = false) {
  const calls: { name: string; args: unknown }[] = [];
  const nativeRequire = createRequire(path.resolve("package.json"));
  function load(file: string): Record<string, unknown> {
    const output = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const loaded = { exports: {} };
    const requireSource = (specifier: string): unknown => {
      if (specifier === "server-only") return {};
      if (specifier === "next/cache") return { revalidatePath() {} };
      if (specifier === "next/navigation") return { redirect(url: string) { throw new Error(url); } };
      if (specifier === "@/lib/auth/session") return { getCurrentStaff: async () => ({ role, organizationId: "org" }) };
      if (specifier === "@/lib/supabase/server") return { createClient: async () => ({ rpc: async (name: string, args: unknown) => { calls.push({ name, args }); return { error: failure ? { code: "XX000" } : null }; } }) };
      if (specifier.startsWith("@/")) return load(path.resolve(specifier.slice(2) + ".ts"));
      return nativeRequire(specifier);
    };
    new Function("require", "module", "exports", output)(requireSource, loaded, loaded.exports);
    return loaded.exports;
  }
  const action = load(path.resolve("app/(app)/catalog/actions.ts")).createSimpleService as (state: { error: string }, form: FormData) => Promise<{ error: string }>;
  return { calls, action };
}

test("service definition validates price precision and duration without inventing defaults", () => {
  expect(simpleServiceValues(form(valid))).toEqual({ name: valid.name, nameAr: valid.nameAr, price: 25.5, minutes: 45 });
  expect(simpleServiceValues(form({ name: valid.name }))).toEqual({ name: valid.name, nameAr: "", price: null, minutes: null });
  for (const change of [{ customerPrice: "-1" }, { customerPrice: "NaN" }, { customerPrice: "1.0001" }, { customerPrice: "1000000" }, { estimatedMinutes: "0" }, { estimatedMinutes: "1441" }, { estimatedMinutes: "1.5" }, { name: " " }]) expect(simpleServiceValues(form({ ...valid, ...change }))).toBeNull();
  expect(simpleServiceValues(form({ ...valid, customerPrice: "0", estimatedMinutes: "1440" }))).not.toBeNull();
  expect(servicePrice({})).toBeNull();
  expect(servicePrice({ service_pricing: { currency: "JOD", customer_price: 25.5 } })).toBe(25.5);
});
test("simple service saves in one authorized RPC", async () => {
  const { calls, action } = actionFixture();
  await expect(action({ error: "" }, form(valid))).rejects.toThrow("created=");
  expect(calls).toEqual([{ name: "save_workshop_service", args: { p_organization_id: "org", p_name: valid.name, p_name_ar: valid.nameAr, p_template_id: null, p_order_type: "maintenance", p_price: 25.5, p_minutes: 45 } }]);
});
test("staff and invalid submissions cannot create services", async () => {
  for (const [role, values] of [["staff", valid], ["admin", { ...valid, customerPrice: "-1" }]] as const) {
    const { calls, action } = actionFixture(role);
    expect((await action({ error: "" }, form(values))).error).not.toBe("");
    expect(calls).toHaveLength(0);
  }
});
test("database failures return a recoverable form error", async () => {
  const { action } = actionFixture("admin", true);
  expect((await action({ error: "" }, form(valid))).error).toBe("The service could not be saved. Please try again.");
});
