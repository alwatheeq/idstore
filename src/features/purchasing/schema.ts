import { z } from "zod";

const optText = z
  .string()
  .optional()
  .transform((v): string | null => {
    const t = (v ?? "").trim();
    return t.length ? t : null;
  });
const reqText = (m: string) => z.string().trim().min(1, m);

const numPos = z.union([z.string(), z.number()]).transform((v, ctx) => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) {
    ctx.addIssue("Must be greater than 0");
    return z.NEVER;
  }
  return n;
});
const numNonNeg = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v, ctx) => {
    if (v === undefined || (typeof v === "string" && v.trim() === "")) return 0;
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n) || n < 0) {
      ctx.addIssue("Must be 0 or more");
      return z.NEVER;
    }
    return n;
  });

export const poSchema = z.object({
  supplier_id: optText,
  reference: optText,
  notes: optText,
});

export const poLineSchema = z.object({
  item_id: reqText("Item is required"),
  quantity: numPos,
  unit_cost: numNonNeg,
});

export type POFormValues = z.input<typeof poSchema>;
export type POPayload = z.output<typeof poSchema>;
export type POLineFormValues = z.input<typeof poLineSchema>;
export type POLinePayload = z.output<typeof poLineSchema>;
