import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import { test, expect } from "@playwright/test";

function fixture(role = "admin", failure = false) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const nativeRequire = createRequire(path.resolve("package.json"));
  function load(file: string): Record<string, unknown> {
    const loaded = { exports: {} };
    const requireSource = (specifier: string): unknown => {
      if (specifier === "server-only") return {};
      if (specifier === "next/cache") return { revalidatePath() {} };
      if (specifier === "next/navigation") return { redirect(url: string) { throw new Error(url); } };
      if (specifier === "@/lib/auth/session") return { getCurrentStaff: async () => ({ role, organizationId: "org" }) };
      if (specifier === "@/lib/supabase/server") return { createClient: async () => ({ rpc: async (name: string, args: Record<string, unknown>) => { calls.push({ name, args }); return { error: failure ? { code: "42501" } : null }; } }) };
      if (specifier.startsWith("@/")) return load(path.resolve(specifier.slice(2) + ".ts"));
      return nativeRequire(specifier);
    };
    const output = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function("require", "module", "exports", output)(requireSource, loaded, loaded.exports);
    return loaded.exports;
  }
  return { calls, manage: load(path.resolve("app/(app)/staff/actions.ts")).manageStaff as (state: { error: string }, data: FormData) => Promise<{ error: string }> };
}
function form(values: Record<string, string> = {}) {
  const result = new FormData();
  Object.entries({ staffAction: "edit", membershipId: "member", displayName: "Technician", role: "staff", status: "active", branchId: "branch", ...values }).forEach(([key, value]) => result.set(key, value));
  return result;
}
test("staff cannot manage accounts and invalid edits never reach the database", async () => {
  const denied = fixture("staff");
  expect((await denied.manage({ error: "" }, form())).error).not.toBe("");
  expect(denied.calls).toHaveLength(0);
  const invalid: Record<string, string>[] = [{ role: "owner" }, { status: "revoked" }, { displayName: "" }, { staffAction: "erase" }];
  for (const values of invalid) {
    const f = fixture();
    expect((await f.manage({ error: "" }, form(values))).error).not.toBe("");
    expect(f.calls).toHaveLength(0);
  }
});
test("admin edits are tenant-scoped and preserve multiple branches and permissions", async () => {
  const f = fixture(), data = form();
  data.append("branchId", "second"); data.append("permissionCode", "inspection.perform"); data.append("permissionCode", "hv_permit.authorize");
  await expect(f.manage({ error: "" }, data)).rejects.toThrow("created=");
  expect(f.calls[0]).toMatchObject({ name: "manage_staff", args: { p_organization_id: "org", p_membership_id: "member", p_action: "edit", p_details: { branchIds: ["branch", "second"], permissionCodes: ["inspection.perform"], role: "staff" } } });
});
test("delete requires explicit confirmation and sends no profile modifications", async () => {
  const f = fixture(), data = form({ staffAction: "delete" });
  expect((await f.manage({ error: "" }, data)).error).toBe("Confirm staff deletion first.");
  expect(f.calls).toHaveLength(0);
  data.set("confirmDelete", "on");
  await expect(f.manage({ error: "" }, data)).rejects.toThrow("created=");
  expect(f.calls[0].args).toEqual({ p_organization_id: "org", p_membership_id: "member", p_action: "delete", p_details: {} });
});
test("database authorization failures remain recoverable form errors", async () => {
  const f = fixture("admin", true);
  expect((await f.manage({ error: "" }, form())).error).toBe("Your account is not authorized for this operation.");
});
