import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import { test, expect } from "@playwright/test";

function fixture(role = "admin", failure?: string) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const nativeRequire = createRequire(path.resolve("package.json"));
  function load(file: string): Record<string, unknown> {
    const loaded = { exports: {} };
    function requireSource(specifier: string): unknown {
      if (specifier === "server-only") return {};
      if (specifier === "next/cache") return { revalidatePath() {} };
      if (specifier === "next/navigation") return { redirect(url: string) { throw new Error(url); } };
      if (specifier === "@/lib/auth/session") return { getCurrentStaff: async () => ({ role, organizationId: "org" }) };
      if (specifier === "@/lib/supabase/server") return { createClient: async () => ({ rpc: async (name: string, args: Record<string, unknown>) => { calls.push({ name, args }); return { error: failure ? { code: failure } : null }; } }) };
      if (specifier.startsWith("@/")) return load(path.resolve(specifier.slice(2) + ".ts"));
      return nativeRequire(specifier);
    }
    const output = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function("require", "module", "exports", output)(requireSource, loaded, loaded.exports);
    return loaded.exports;
  }
  const actions = load(path.resolve("app/(app)/records/manage/actions.ts")) as { manageRecord: (form: FormData) => Promise<never>; discardDraft: (form: FormData) => Promise<never> };
  return { calls, ...actions };
}
function form(values: Record<string, string> = {}) {
  const form = new FormData();
  Object.entries({ kind: "supplier", id: "record", mode: "edit", name: "Parts supplier", updatedAt: "2026-09-08T00:00:00Z", ...values }).forEach(([key, value]) => form.set(key, value));
  return form;
}
test("directory writes require admin and allowlisted entities", async () => {
  const denied = fixture("staff");
  await expect(denied.manageRecord(form())).rejects.toThrow("/dashboard");
  expect(denied.calls).toHaveLength(0);
  for (const kind of ["invoices", "memberships", "__proto__", "constructor"]) {
    const f = fixture(); await expect(f.manageRecord(form({ kind }))).rejects.toThrow("/dashboard"); expect(f.calls).toHaveLength(0);
  }
});
test("directory edits send only allowed columns and the authenticated organization", async () => {
  const f = fixture();
  await expect(f.manageRecord(form({ organizationId: "other", status: "archived", role: "admin" }))).rejects.toThrow("/purchasing?created=");
  expect(f.calls).toEqual([{ name: "manage_directory_record", args: { p_organization_id: "org", p_kind: "supplier", p_id: "record", p_mode: "edit", p_updated_at: "2026-09-08T00:00:00Z", p_changes: { name: "Parts supplier", tax_number: null, phone: null, email: null }, p_reason: "" } }]);
});
test("archive and restore require explicit confirmation", async () => {
  for (const mode of ["archive", "restore"]) {
    const missing = fixture(); await expect(missing.manageRecord(form({ mode }))).rejects.toThrow("error="); expect(missing.calls).toHaveLength(0);
    const confirmed = fixture(); await expect(confirmed.manageRecord(form({ mode, confirmed: "on", reason: "Duplicate record" }))).rejects.toThrow("/purchasing?created=");
    expect(confirmed.calls[0].args).toMatchObject({ p_mode: mode, p_changes: {}, p_reason: "Duplicate record" });
  }
});
test("invalid prices and required fields do not reach the database", async () => {
  for (const price of ["-1", "Infinity", "1000000000", "1.1111", "0x10", ""]) {
    const f = fixture(); await expect(f.manageRecord(form({ kind: "part", description_en: "Filter", sale_price: price }))).rejects.toThrow("error="); expect(f.calls).toHaveLength(0);
  }
  const f = fixture(); await expect(f.manageRecord(form({ name: "" }))).rejects.toThrow("error="); expect(f.calls).toHaveLength(0);
});
test("capacity redirects preserve their existing tab query", async () => {
  const f = fixture(); await expect(f.manageRecord(form({ kind: "resource", name: "Lift" }))).rejects.toThrow("/catalog?tab=capacity&created=");
});
test("stale changes are surfaced as errors, never as successful saves", async () => {
  const f = fixture("admin", "40001"); await expect(f.manageRecord(form())).rejects.toThrow("error=This%20record%20changed.");
});
test("discard restricts financial writes to explicit admin-confirmed drafts", async () => {
  const denied = fixture("staff"); await expect(denied.discardDraft(form({ kind: "invoice", confirmed: "on" }))).rejects.toThrow("/dashboard"); expect(denied.calls).toHaveLength(0);
  const absent = fixture(); await expect(absent.discardDraft(form({ kind: "invoice" }))).rejects.toThrow("error="); expect(absent.calls).toHaveLength(0);
  for (const kind of ["invoice", "estimate"]) {
    const f = fixture(); await expect(f.discardDraft(form({ kind, confirmed: "on", reason: "Duplicate draft" }))).rejects.toThrow("created=Draft");
    expect(f.calls[0]).toMatchObject({ name: "discard_draft_document", args: { p_organization_id: "org", p_kind: kind, p_reason: "Duplicate draft" } });
  }
});
