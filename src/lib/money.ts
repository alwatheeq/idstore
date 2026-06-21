export type DiscountType = "none" | "amount" | "percent";
export type PaymentStatus = "unpaid" | "partial" | "paid";

export interface LineInput {
  quantity: number;
  unitPrice: number;
  discountType: DiscountType;
  discountValue: number;
}

/** Round to 3 decimal places (JOD) avoiding binary float drift. */
const round3 = (n: number): number => Math.round((n + Number.EPSILON) * 1000) / 1000;

const lineGross = (l: LineInput): number => l.quantity * l.unitPrice;

const lineDiscount = (l: LineInput): number => {
  if (l.discountType === "amount") return l.discountValue;
  if (l.discountType === "percent") return lineGross(l) * (l.discountValue / 100);
  return 0;
};

export function computeLineTotal(line: LineInput): number {
  const net = lineGross(line) - lineDiscount(line);
  return round3(Math.max(0, net));
}

export function computeInvoiceTotals(lines: LineInput[]): {
  subtotal: number; discountTotal: number; total: number;
} {
  const subtotal = round3(lines.reduce((s, l) => s + lineGross(l), 0));
  const discountTotal = round3(lines.reduce((s, l) => s + lineDiscount(l), 0));
  const total = round3(Math.max(0, subtotal - discountTotal));
  return { subtotal, discountTotal, total };
}

export function derivePaymentStatus(total: number, paidSum: number): PaymentStatus {
  if (paidSum <= 0) return "unpaid";
  if (paidSum >= total) return "paid";
  return "partial";
}
