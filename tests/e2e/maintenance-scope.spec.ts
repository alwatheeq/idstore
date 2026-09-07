import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { createRequire } from "node:module";
import { test, expect } from "@playwright/test";

const runtimeRequire = createRequire(path.resolve("package.json"));
type Action = (form: FormData) => Promise<unknown>;

function actions(filename: string) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  function load(file: string): Record<string, Action> {
    const output = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const loaded = { exports: {} };
    const localRequire = (specifier: string): unknown => {
      if (specifier === "server-only" || specifier === "@/lib/supabase/commands") return {};
      if (specifier === "next/cache") return { revalidatePath: () => {} };
      if (specifier === "next/navigation") return { redirect: (url: string) => { throw new Error(url); } };
      if (specifier === "@/lib/auth/session") return {
        getCurrentStaff: async () => ({ role: "admin", organizationId: "org", selectedBranchId: "branch" }),
        resolveOperatingBranch: () => "branch",
      };
      if (specifier === "@/lib/supabase/server") return { createClient: async () => ({
        rpc: async (name: string, args: Record<string, unknown>) => {
          calls.push({ name, args }); return { data: { id: "test-record" }, error: null };
        },
      }) };
      if (!specifier.startsWith("@/") && !specifier.startsWith(".")) return runtimeRequire(specifier);
      const base = specifier.startsWith("@/") ? path.resolve(specifier.slice(2)) : path.resolve(path.dirname(file), specifier);
      return load(base + ".ts");
    };
    new Function("require", "module", "exports", output)(localRequire, loaded, loaded.exports);
    return loaded.exports;
  }
  return { calls, module: load(path.resolve(filename)) };
}

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

test("new workshop jobs default to maintenance without qualification gates", async () => {
  const { module, calls } = actions("app/(app)/work-orders/actions.ts");
  await expect(module.createJob(form({ repairOrderId: "order", description: "Brake inspection", plannedMinutes: "30", qualificationCode: "HV_TECHNICIAN" }))).rejects.toThrow("created=");
  expect(calls).toEqual([{ name: "create_job", args: {
    p_repair_order_id: "order", p_description: "Brake inspection", p_operation_code: "",
    p_safety_class: "normal", p_required_qualification_code: "", p_planned_minutes: 30,
  } }]);
});

test("forged specialist job submissions are rejected before calling the database", async () => {
  const { module, calls } = actions("app/(app)/work-orders/actions.ts");
  for (const safetyClass of ["hv_isolated", "hv_battery_open"]) {
    await expect(module.createJob(form({ repairOrderId: "order", description: "Test", plannedMinutes: "30", safetyClass }))).rejects.toThrow("error=");
  }
  expect(calls).toEqual([]);
});

test("service catalog defaults to maintenance and rejects specialist classes", async () => {
  const { module, calls } = actions("app/(app)/catalog/actions.ts");
  const values = { versionId: "version", taskCode: "BRAKES", descriptionEn: "Inspect brakes", standardMinutes: "30" };
  await expect(module.addServiceTask(form(values))).rejects.toThrow("created=");
  expect(calls[0].args).toMatchObject({ p_required_qualification_code: "", p_result_schema: { safety_class: "normal" } });
  await expect(module.addServiceTask(form({ ...values, safetyClass: "hv_isolated" }))).rejects.toThrow("error=");
  await expect(module.addServiceTask(form({ ...values, requiredPermission: "hv_permit.authorize" }))).rejects.toThrow("error=");
  expect(calls).toHaveLength(1);
});

test("branch creation cannot enable retired HV capability through an old form", async () => {
  const { module, calls } = actions("app/(app)/branches/actions.ts");
  await expect(module.createBranch(form({
    code: "TEST-01", city: "Amman", displayName: "Test branch", legalName: "Test",
    addressLine1: "Test street", phone: "+96260000000", whatsapp: "+962790000000", hvCapable: "on",
  }))).rejects.toThrow("created=");
  expect(calls[0].args.p_hv_capable).toBe(false);
});

test("inspection assignment drops retired capabilities and refuses specialist configuration", async () => {
  const { module, calls } = actions("app/(app)/inspections/actions.ts");
  const assignment = form({ workflowAction: "assign", inspectionId: "inspection" });
  for (const capability of ["ac", "dc", "hv", "soh"]) assignment.append("capabilities", capability);
  await expect(module.saveInspectionWorkflow(assignment)).resolves.toEqual({ success: true });
  expect(calls[0].args.p_data).toMatchObject({ capabilities: ["ac", "dc"] });
  await expect(module.saveInspectionWorkflow(form({ workflowAction: "configure", "rule.capability": "hv" }))).resolves.toEqual({ error: "Outside maintenance scope" });
  expect(calls).toHaveLength(1);
});
