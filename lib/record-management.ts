export type RecordField = { name: string; label: string; required?: boolean; type?: "text" | "email" | "tel" | "number" | "textarea"; options?: { value: string; label: string }[]; maxLength?: number };
type RecordDefinition = { table: "customers" | "vehicles" | "parts" | "suppliers" | "branches" | "resources" | "inspection_check_definitions"; title: string; back: string; name: string; fields: RecordField[] };

// This allowlist is intentionally separate from transactional/financial records.
export const recordDefinitions: Record<string, RecordDefinition> = {
  customer: { table: "customers", title: "Customer", back: "/customers", name: "display_name", fields: [
    { name: "display_name", label: "Name", required: true }, { name: "customer_type", label: "Customer type", required: true, options: [{ value: "individual", label: "Individual" }, { value: "company", label: "Company / fleet" }] },
    { name: "legal_name", label: "Legal name" }, { name: "tax_number", label: "Tax number" }, { name: "notes", label: "Notes", type: "textarea", maxLength: 2000 },
  ] },
  vehicle: { table: "vehicles", title: "Vehicle", back: "/vehicles", name: "registration_no", fields: [] },
  part: { table: "parts", title: "Part", back: "/inventory", name: "part_number", fields: [
    { name: "description_en", label: "Description (English)", required: true }, { name: "description_ar", label: "Description (Arabic)" }, { name: "sale_price", label: "Sale price (JOD)", type: "number", required: true },
  ] },
  supplier: { table: "suppliers", title: "Supplier", back: "/purchasing", name: "name", fields: [
    { name: "name", label: "Name", required: true }, { name: "tax_number", label: "Tax number" }, { name: "phone", label: "Phone", type: "tel" }, { name: "email", label: "Email", type: "email" },
  ] },
  branch: { table: "branches", title: "Branch", back: "/branches", name: "display_name", fields: [
    { name: "display_name", label: "Display name", required: true }, { name: "legal_name", label: "Legal name", required: true }, { name: "city", label: "City", required: true },
  ] },
  resource: { table: "resources", title: "Resource", back: "/catalog?tab=capacity", name: "name", fields: [{ name: "name", label: "Name", required: true }] },
  check: { table: "inspection_check_definitions", title: "Inspection check", back: "/inspections", name: "label_en", fields: [
    { name: "label_en", label: "Description (English)", required: true, maxLength: 160 }, { name: "label_ar", label: "Description (Arabic)", required: true, maxLength: 160 },
  ] },
};

export function recordDefinition(kind: string) {
  return Object.hasOwn(recordDefinitions, kind) ? recordDefinitions[kind] : undefined;
}

export function recordManagementHref(kind: string, id: string, action: "edit" | "archive" | "restore" = "edit") {
  return `/records/manage?${new URLSearchParams({ kind, id, action })}`;
}
