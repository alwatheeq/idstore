export type DiscountType = "none" | "amount" | "percent";
export type PaymentStatus = "unpaid" | "partial" | "paid";

export interface LineInput {
  quantity: number;
  unitPrice: number;
  discountType: DiscountType;
  discountValue: number;
}

/** Round to 3 decimal places (JOD) avoiding binary float drift. Works correctly for both positive and negative values. */
const round3 = (n: number): number => Math.round(n * 1000 + Number.EPSILON) / 1000;

const safe = (n: number): number => (Number.isFinite(n) ? n : 0);

const lineGross = (l: LineInput): number => safe(l.quantity) * safe(l.unitPrice);

const lineDiscount = (l: LineInput): number => {
  if (l.discountType === "amount") return safe(l.discountValue);
  if (l.discountType === "percent") return lineGross(l) * (safe(l.discountValue) / 100);
  return 0;
};

/**
 * Compute the rounded net total for a single invoice line.
 *
 * Clamping: when the discount exceeds the gross, the line total is clamped to 0
 * (never negative). Percent discounts are not capped at 100 — a value above 100
 * will simply drive the gross negative, which the clamp absorbs.
 */
export function computeLineTotal(line: LineInput): number {
  const net = lineGross(line) - lineDiscount(line);
  return round3(Math.max(0, net));
}

export function computeInvoiceTotals(lines: LineInput[]): {
  subtotal: number; discountTotal: number; total: number;
} {
  const subtotal = round3(lines.reduce((s, l) => s + lineGross(l), 0));
  const total = round3(lines.reduce((s, l) => s + computeLineTotal(l), 0));
  const discountTotal = round3(Math.max(0, subtotal - total));
  return { subtotal, discountTotal, total };
}

export function derivePaymentStatus(total: number, paidSum: number): PaymentStatus {
  const t = safe(total);
  const p = safe(paidSum);
  if (p <= 0) return "unpaid";
  if (p >= t) return "paid";
  return "partial";
}
