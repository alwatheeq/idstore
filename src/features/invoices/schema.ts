import { z } from "zod";

const optText = z.string().optional().transform((v) => {
  const t = (v ?? "").trim(); return t.length ? t : null;
});

const reqPositive = z.union([z.string(), z.number()]).transform((v, ctx) => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) { ctx.addIssue("Must be greater than 0"); return z.NEVER; }
  return n;
});

export const paymentSchema = z.object({
  amount: reqPositive,
  method: z.enum(["cash", "card", "transfer"]).default("cash"),
  note: optText,
});

export type PaymentFormValues = z.input<typeof paymentSchema>;
export type PaymentPayload = z.output<typeof paymentSchema>;
