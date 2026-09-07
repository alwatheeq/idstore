export type NavigationItem = {
  href: string;
  label: string;
  permissionAny?: string[];
  adminOnly?: boolean;
};

export type NavigationGroup = {
  key: "overview" | "reception" | "workshop" | "parts" | "commercial" | "administration";
  label: string;
  items: NavigationItem[];
};

export const navigationGroups: NavigationGroup[] = [
  { key: "overview", label: "Overview", items: [{ href: "/dashboard", label: "Control room" }] },
  {
    key: "reception",
    label: "Reception & CRM",
    items: [
      { href: "/appointments", label: "Appointments", permissionAny: ["appointments.manage"] },
      { href: "/customers", label: "Customers", permissionAny: ["crm.manage"] },
      { href: "/vehicles", label: "Vehicles", permissionAny: ["crm.manage"] },
    ],
  },
  {
    key: "workshop",
    label: "Service floor",
    items: [
      { href: "/work-orders", label: "Work orders", permissionAny: ["repair_order.manage", "workshop.dispatch", "job.perform"] },
      { href: "/inspections", label: "Inspections", permissionAny: ["inspection.perform"] },
      { href: "/estimates", label: "Estimates", permissionAny: ["estimate.manage"] },
      { href: "/diagnostics", label: "Diagnostics", permissionAny: ["job.perform"] },
      { href: "/quality-campaigns", label: "Quality & campaigns", permissionAny: ["inspection.perform", "report.operations.read"] },
    ],
  },
  {
    key: "parts",
    label: "Parts & supply",
    items: [
      { href: "/inventory", label: "Parts & stock", permissionAny: ["inventory.manage"] },
      { href: "/stock-control", label: "Transfers & counts", permissionAny: ["inventory.manage"] },
      { href: "/purchasing", label: "Purchasing", permissionAny: ["purchasing.manage"] },
    ],
  },
  {
    key: "commercial",
    label: "Commercial & records",
    items: [
      { href: "/invoices", label: "Billing", permissionAny: ["invoice.post", "payment.receive"] },
      { href: "/finance-control", label: "Finance controls", permissionAny: ["payment.receive", "payment.refund"] },
      { href: "/records", label: "Files & messages" },
      { href: "/reports", label: "Reports", permissionAny: ["report.operations.read", "report.finance.read"] },
    ],
  },
  {
    key: "administration",
    label: "Settings",
    items: [
      { href: "/branches", label: "Branches", permissionAny: ["branch.manage"] },
      { href: "/staff", label: "Staff accounts", permissionAny: ["staff.manage"], adminOnly: true },
      { href: "/settings/access", label: "Roles & permissions", adminOnly: true },
      { href: "/catalog", label: "Catalog & capacity", permissionAny: ["branch.manage"] },
      { href: "/governance", label: "Integrations & audit", permissionAny: ["integration.manage", "audit.read"] },
    ],
  },
];

export function visibleNavigationGroups(role: "admin" | "staff", permissionCodes: string[]) {
  if (role === "admin") return navigationGroups;
  const permissions = new Set(permissionCodes);
  return navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.adminOnly && (!item.permissionAny || item.permissionAny.some((code) => permissions.has(code)))),
    }))
    .filter((group) => group.items.length > 0);
}
