import { computeLineTotal, computeInvoiceTotals, type LineInput } from "@/lib/money";
import type { ServiceOrderLine, DiscountType } from "./types";
import type { LinePayload } from "./schema";

export function lineToInput(l: Pick<ServiceOrderLine, "quantity" | "unit_price" | "discount_type" | "discount_value">): LineInput {
  return { quantity: l.quantity, unitPrice: l.unit_price, discountType: l.discount_type, discountValue: l.discount_value };
}
export function computeLineTotalFromRow(l: ServiceOrderLine): number {
  return computeLineTotal(lineToInput(l));
}
export function lineTotalForPayload(p: LinePayload): number {
  return computeLineTotal({
    quantity: p.quantity, unitPrice: p.unit_price,
    discountType: p.discount_type as DiscountType, discountValue: p.discount_value,
  });
}
export function computeOrderTotals(lines: ServiceOrderLine[]) {
  return computeInvoiceTotals(lines.map(lineToInput));
}
