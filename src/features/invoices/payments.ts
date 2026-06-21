import { derivePaymentStatus, type PaymentStatus } from "@/lib/money";

const round3 = (n: number): number => Math.round(n * 1000 + Number.EPSILON) / 1000;

export function sumPayments(payments: { amount: number }[]): number {
  return round3(payments.reduce((s, p) => s + p.amount, 0));
}

export function paymentStatusFor(total: number, payments: { amount: number }[]): PaymentStatus {
  return derivePaymentStatus(total, sumPayments(payments));
}
