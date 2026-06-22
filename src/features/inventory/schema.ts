import { z } from "zod";

const optText = z
  .string()
  .optional()
  .transform((v): string | null => {
    const t = (v ?? "").trim();
    return t.length ? t : null;
  });
const reqText = (m: string) => z.string().trim().min(1, m);

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
const numPos = z.union([z.string(), z.number()]).transform((v, ctx) => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) {
    ctx.addIssue("Must be greater than 0");
    return z.NEVER;
  }
  return n;
});
const numNonZero = z.union([z.string(), z.number()]).transform((v, ctx) => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n === 0) {
    ctx.addIssue("Must not be zero");
    return z.NEVER;
  }
  return n;
});

export const itemSchema = z.object({
  name: reqText("Name is required"),
  sku: optText,
  category: optText,
  unit: z
    .string()
    .optional()
    .transform((v) => {
      const t = (v ?? "").trim();
      return t.length ? t : "pcs";
    }),
  cost: numNonNeg,
  sale_price: numNonNeg,
  reorder_level: numNonNeg,
  supplier_id: optText,
  is_active: z.boolean().default(true),
});

export const supplierSchema = z.object({
  name: reqText("Name is required"),
  contact: optText,
  phone: optText,
  email: optText,
});

export const receiveSchema = z.object({ quantity: numPos, unit_cost: numNonNeg, reference: optText });
export const issueSchema = z.object({ quantity: numPos, reference: optText });
export const adjustSchema = z.object({ quantity_delta: numNonZero, reference: optText });
export const transferSchema = z.object({
  quantity: numPos,
  to_branch_id: reqText("Destination branch is required"),
  reference: optText,
});
export const countSchema = z.object({ counted: numNonNeg, reference: optText });

export type ItemFormValues = z.input<typeof itemSchema>;
export type ItemPayload = z.output<typeof itemSchema>;
export type SupplierFormValues = z.input<typeof supplierSchema>;
export type SupplierPayload = z.output<typeof supplierSchema>;
