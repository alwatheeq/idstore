import type { Json } from "@/lib/database.types";

export function isMaintenanceTask(schema: Json) {
  return !(schema && typeof schema === "object" && !Array.isArray(schema)
    && typeof schema.safety_class === "string" && schema.safety_class.startsWith("hv_"));
}

/** Validate money before calling the existing, authoritative estimate ledger. */
export function maintenanceItemValues(form: FormData) {
  const text = (key: string) => String(form.get(key) ?? "").trim();
  const type = text("lineType");
  const quantity = text("quantity"), price = text("unitPrice"), tax = text("taxRate") || "0";
  const decimal = /^\d+(\.\d{1,3})?$/;
  if (!["labor", "part"].includes(type) || !text("catalogId")
      || ![quantity, price, tax].every(value => decimal.test(value))
      || Number(quantity) <= 0 || Number(quantity) > 99999
      || Number(price) > 999999.999 || Number(tax) > 100) return null;
  return { type: type as "labor" | "part", catalogId: text("catalogId"), quantity: Number(quantity), price: Number(price), tax: Number(tax) };
}
