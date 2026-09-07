import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import { test, expect } from "@playwright/test";
import { isMaintenanceTask, maintenanceItemValues } from "../../lib/maintenance-order";
import { translatePageText } from "../../lib/i18n/ui";

const valid = { repairOrderId: "order", estimateId: "estimate", lineType: "part", catalogId: "part", quantity: "2", unitPrice: "10.250", taxRate: "16" };
function form(values = valid) { const result = new FormData(); Object.entries(values).forEach(([key, value]) => result.set(key, value)); return result; }
function fixture(options: { branch?: string; orderStatus?: string; estimateStatus?: string; failure?: boolean; missingItem?: boolean; missingSelection?: boolean; serviceType?: string } = {}) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const queries: { table: string; filters: [string, unknown][] }[] = [];
  const nativeRequire = createRequire(path.resolve("package.json"));
  function load(file: string): Record<string, unknown> {
    const loaded = { exports: {} };
    const requireSource = (specifier: string): unknown => {
      if (specifier === "server-only") return {};
      if (specifier === "next/cache") return { revalidatePath() {} };
      if (specifier === "next/navigation") return { redirect(url: string) { throw new Error(url); } };
      if (specifier === "@/lib/auth/session") return { getCurrentStaff: async () => ({ role: "staff", organizationId: "org", selectedBranchId: "branch" }), resolveOperatingBranch: () => "branch" };
      if (specifier === "@/lib/supabase/commands") return { createRepairOrder: async (_client: unknown, args: Record<string, unknown>) => { calls.push({ name: "create_repair_order", args }); return { id: "new-order" }; } };
      if (specifier === "@/lib/supabase/server") return { createClient: async () => ({
        from(table: string) {
          const query = { table, filters: [] as [string, unknown][] }; queries.push(query);
          const builder = { select() { return builder; }, in() { return builder; }, eq(key: string, value: unknown) { query.filters.push([key, value]); return builder; },
            lte() { return builder; }, or() { return builder; }, async limit() { return { data: table === "work_order_service_choices" && options.missingSelection ? [] : [{ id: "ownership" }], error: null }; },
            async single() {
              const data = table === "repair_orders" ? { id: "order", branch_id: options.branch ?? "branch", status: options.orderStatus ?? "checked_in" }
                : ["estimate_versions", "invoices"].includes(table) ? { id: table === "invoices" ? "invoice" : "estimate", status: options.estimateStatus ?? "draft" }
                : table === "estimate_lines" ? { id: "line", estimate: { repair_order_id: "order", status: options.estimateStatus ?? "draft" } }
                : table === "invoice_lines" ? { id: "line", invoice: { repair_order_id: "order", status: options.estimateStatus ?? "draft" } }
                : options.missingItem ? null : table === "parts" ? { part_number: "SKU-1", description_en: "Filter", description_ar: "فلتر" }
                : { effective_from: "2020-01-01", effective_to: null, template: { name_en: "Brake inspection", name_ar: "فحص الفرامل", work_order_type: options.serviceType ?? "maintenance" }, service_template_tasks: [{ result_schema: { safety_class: "normal" } }] };
              return { data, error: null };
            } }; return builder;
        },
        async rpc(name: string, args: Record<string, unknown>) { calls.push({ name, args }); return { error: options.failure ? { code: "42501" } : null }; },
      }) };
      if (specifier.startsWith("@/")) return load(path.resolve(specifier.slice(2) + ".ts"));
      if (specifier.startsWith(".")) return load(path.resolve(path.dirname(file), specifier + ".ts"));
      return nativeRequire(specifier);
    };
    const source = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function("require", "module", "exports", source)(requireSource, loaded, loaded.exports);
    return loaded.exports;
  }
  const actions = load(path.resolve("app/(app)/work-orders/item-actions.ts")) as {
    addOrderItem: (state: { error: string }, data: FormData) => Promise<{ error: string }>;
    prepareOrderItems: (data: FormData) => Promise<never>;
    removeOrderItem: (data: FormData) => Promise<never>;
  };
  const createWorkOrder = load(path.resolve("app/(app)/work-orders/actions.ts")).createWorkOrder as (data: FormData) => Promise<never>;
  return { calls, queries, ...actions, createWorkOrder };
}
test("order item quantities and money use bounded decimal validation", () => {
  expect(maintenanceItemValues(form())).toMatchObject({ type: "part", quantity: 2, price: 10.25, tax: 16 });
  for (const update of [{ quantity: "0" }, { quantity: "Infinity" }, { unitPrice: "" }, { unitPrice: "-1" }, { unitPrice: "1.0001" }, { taxRate: "101" }, { lineType: "fee" }, { catalogId: "" }]) expect(maintenanceItemValues(form({ ...valid, ...update }))).toBeNull();
  expect(maintenanceItemValues(form({ ...valid, unitPrice: "0" }))).not.toBeNull();
  expect(isMaintenanceTask({ safety_class: "normal" })).toBe(true);
  expect(isMaintenanceTask({ safety_class: "hv_isolated" })).toBe(false);
});
test("staff adds catalog parts to the existing pricing ledger, without issuing stock", async () => {
  const f = fixture();
  expect(await f.addOrderItem({ error: "" }, form())).toEqual({ error: "" });
  expect(f.calls).toEqual([{ name: "add_estimate_line", args: {
    p_estimate_id: "estimate", p_line_type: "part", p_description: "SKU-1 · Filter / فلتر",
    p_quantity: 2, p_unit_price: 10.25, p_tax_rate: 16, p_discount_amount: 0, p_approval_group: "General", p_finding_id: null,
  } }]);
  for (const query of f.queries) expect(query.filters).toContainEqual(["organization_id", "org"]);
  expect(f.queries.find(query => query.table === "estimate_versions")?.filters).toContainEqual(["repair_order_id", "order"]);
});
test("service names come from the catalog and draft preparation does not transition the order", async () => {
  const f = fixture();
  expect(await f.addOrderItem({ error: "" }, form({ ...valid, lineType: "labor" }))).toEqual({ error: "" });
  expect(f.calls[0].args.p_description).toBe("Brake inspection / فحص الفرامل");
  await expect(f.prepareOrderItems(form())).rejects.toThrow("#order-items");
  expect(f.calls.map(call => call.name)).toEqual(["add_estimate_line", "create_estimate_from_repair_order"]);
});
test("branch mismatch, closed orders, locked prices and unavailable items block writes", async () => {
  for (const options of [{ branch: "other" }, { orderStatus: "closed" }, { estimateStatus: "approved" }, { estimateStatus: "sent" }, { missingItem: true }]) {
    const f = fixture(options);
    expect((await f.addOrderItem({ error: "" }, form())).error).not.toBe("");
    expect(f.calls).toHaveLength(0);
  }
  const denied = fixture({ failure: true });
  expect((await denied.addOrderItem({ error: "" }, form())).error).toBe("Your account is not authorized for this operation.");
});
test("pricing requires inspection selection and matching work order type", async () => {
  for (const options of [{ missingSelection: true }, { serviceType: "bodyshop" }]) {
    const f = fixture(options);
    expect((await f.addOrderItem({ error: "" }, form({ ...valid, lineType: "labor" }))).error).not.toBe("");
    expect(f.calls).toHaveLength(0);
  }
});
test("intake distinguishes maintenance and bodyshop and rejects unknown types", async () => {
  for (const orderType of ["maintenance", "bodyshop", "invalid"]) {
    const f = fixture(); const data = new FormData();
    data.set("customerId", "customer"); data.set("vehicleId", "vehicle"); data.set("orderType", orderType);
    await expect(f.createWorkOrder(data)).rejects.toThrow(orderType === "invalid" ? "error=" : "order=new-order");
    if (orderType === "invalid") expect(f.calls).toHaveLength(0);
    else expect(f.calls[0].args.orderType).toBe(orderType);
  }
});
test("remove rechecks the order and draft, and returns to the same workspace", async () => {
  const f = fixture();
  const data = form(); data.set("lineId", "line");
  await expect(f.removeOrderItem(data)).rejects.toThrow("order=order#order-items");
  expect(f.calls[0]).toEqual({ name: "remove_estimate_line", args: { p_estimate_line_id: "line" } });
  const locked = fixture({ estimateStatus: "approved" });
  await expect(locked.removeOrderItem(data)).rejects.toThrow("error=");
  expect(locked.calls).toHaveLength(0);
});
test("maintenance labels use appropriate Arabic workshop terms", () => {
  for (const [english, arabic] of [["Maintenance orders", "أوامر الصيانة"], ["Spare parts", "قطع الغيار"], ["Unit price", "سعر الوحدة"]]) expect(translatePageText(english, "ar")).toBe(arabic);
});
test("routine maintenance intake needs no invented complaint and opens the new order", async () => {
  const f = fixture();
  const data = new FormData(); data.set("customerId", "customer"); data.set("vehicleId", "vehicle");
  await expect(f.createWorkOrder(data)).rejects.toThrow("order=new-order");
  expect(f.calls[0]).toMatchObject({ name: "create_repair_order", args: { branchId: "branch", customerId: "customer", vehicleId: "vehicle", customerConcern: "" } });
  expect(f.queries.find(query => query.table === "vehicle_ownerships")?.filters).toContainEqual(["customer_id", "customer"]);
});
test("legacy draft invoices reuse the invoice ledger with optimistic version checks", async () => {
  const f = fixture();
  const data = form(); data.set("invoiceId", "invoice"); data.set("version", "3");
  expect(await f.addOrderItem({ error: "" }, data)).toEqual({ error: "" });
  expect(f.calls[0]).toMatchObject({ name: "add_invoice_line", args: { p_invoice_id: "invoice", p_expected_version: 3, p_quantity: 2, p_unit_price: 10.25 } });
  data.set("ledger", "invoice"); data.set("lineId", "line");
  await expect(f.removeOrderItem(data)).rejects.toThrow("#order-items");
  expect(f.calls[1]).toEqual({ name: "remove_invoice_line", args: { p_invoice_line_id: "line", p_expected_version: 3 } });
  const posted = fixture({ estimateStatus: "posted" });
  expect((await posted.addOrderItem({ error: "" }, data)).error).not.toBe("");
  await expect(posted.removeOrderItem(data)).rejects.toThrow("error=");
  expect(posted.calls).toHaveLength(0);
  const missingVersion = fixture(); data.delete("version");
  expect((await missingVersion.addOrderItem({ error: "" }, data)).error).not.toBe("");
  expect(missingVersion.calls).toHaveLength(0);
});
