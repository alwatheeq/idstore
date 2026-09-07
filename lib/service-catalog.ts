import type { Json } from "@/lib/database.types";

export function servicePrice(value: Json): number | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const pricing = value.service_pricing;
  if (!pricing || typeof pricing !== "object" || Array.isArray(pricing) || pricing.currency !== "JOD") return null;
  return typeof pricing.customer_price === "number" && Number.isFinite(pricing.customer_price) && pricing.customer_price >= 0 ? pricing.customer_price : null;
}

export function simpleServiceValues(form: FormData) {
  const name = String(form.get("name") ?? "").trim();
  const nameAr = String(form.get("nameAr") ?? "").trim();
  const priceText = String(form.get("customerPrice") ?? "").trim();
  const minutesText = String(form.get("estimatedMinutes") ?? "").trim();
  const price = priceText ? Number(priceText) : null, minutes = minutesText ? Number(minutesText) : null;
  if (!name || name.length > 160 || nameAr.length > 160
      || (price !== null && (!/^\d+(\.\d{1,3})?$/.test(priceText) || !Number.isFinite(price) || price > 999999.999))
      || (minutes !== null && (!/^\d+$/.test(minutesText) || !Number.isInteger(minutes) || minutes < 1 || minutes > 1440))) return null;
  return { name, nameAr, price, minutes };
}
