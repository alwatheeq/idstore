import fs from "node:fs";
import { expect, test } from "@playwright/test";
import { visibleNavigationGroups } from "../../lib/navigation";

test("removed diagnostics module has no page, actions or navigation", () => {
  expect(fs.existsSync("app/(app)/diagnostics/page.tsx")).toBe(false);
  expect(fs.existsSync("app/(app)/diagnostics/actions.ts")).toBe(false);
  for (const role of ["admin", "staff"] as const) {
    const routes = visibleNavigationGroups(role, ["job.perform", "inspection.perform"]).flatMap(group => group.items.map(item => item.href));
    expect(routes).not.toContain("/diagnostics");
    expect(routes).toContain("/inspections");
    expect(routes).toContain("/work-orders");
  }
  const orders = fs.readFileSync("app/(app)/work-orders/page.tsx", "utf8");
  expect(orders).not.toContain("/diagnostics");
  expect(orders).toContain("/inspections?order=");
});

test("vehicle registry and upload forms no longer expose diagnostic measurements", () => {
  const vehicles = fs.readFileSync("app/(app)/vehicles/page.tsx", "utf8");
  expect(vehicles).not.toMatch(/battery_health_reports|Average battery SOH|Battery SOH/);
  for (const file of ["app/(app)/records/page.tsx", "app/(app)/records/actions.ts"]) {
    expect(fs.readFileSync(file, "utf8")).not.toMatch(/diagnostic_session|battery_health_report/);
  }
  // Retirement must not remove access to historical, tenant-scoped documents.
  const documents = fs.readFileSync("components/record-documents.tsx", "utf8");
  expect(documents).toContain('type: "diagnostic_session"');
  expect(documents).toContain('type: "battery_health_report"');
  expect(documents).toContain('.eq("organization_id", organizationId)');
});
