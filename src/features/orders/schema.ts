import { z } from "zod";

const optText = z.string().optional().transform((v) => {
  const t = (v ?? "").trim(); return t.length ? t : null;
});
const reqText = (msg: string) => z.string().trim().min(1, msg);

const optNum = (opts?: { min?: number; max?: number; int?: boolean }) =>
  z.union([z.string(), z.number()]).optional().transform((v, ctx) => {
    if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) return null;
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n) || (opts?.int && !Number.isInteger(n))) { ctx.addIssue("Must be a number"); return z.NEVER; }
    if (opts?.min != null && n < opts.min) { ctx.addIssue(`Must be ≥ ${opts.min}`); return z.NEVER; }
    if (opts?.max != null && n > opts.max) { ctx.addIssue(`Must be ≤ ${opts.max}`); return z.NEVER; }
    return n;
  });

const reqPositive = z.union([z.string(), z.number()]).transform((v, ctx) => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) { ctx.addIssue("Must be greater than 0"); return z.NEVER; }
  return n;
});
const reqNonNeg = z.union([z.string(), z.number()]).transform((v, ctx) => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 0) { ctx.addIssue("Must be 0 or more"); return z.NEVER; }
  return n;
});

export const intakeSchema = z.object({
  customer_id: reqText("Customer is required"),
  vehicle_id: reqText("Vehicle is required"),
  odometer_at_intake: optNum({ min: 0, int: true }),
  charge_percent: optNum({ min: 0, max: 100, int: true }),
  hv_battery_state: optText,
  reported_concerns: optText,
  intake_notes: optText,
  concerns: z
    .array(z.object({ key: z.string(), checked: z.boolean() }))
    .default([]),
});

export const lineSchema = z.object({
  line_type: z.enum(["service", "part", "fee"]).default("service"),
  description: reqText("Description is required"),
  quantity: reqPositive,
  unit_price: reqNonNeg,
  discount_type: z.enum(["none", "amount", "percent"]).default("none"),
  discount_value: reqNonNeg.default(0),
});

export type IntakeFormValues = z.input<typeof intakeSchema>;
export type IntakePayload = z.output<typeof intakeSchema>;
export type LineFormValues = z.input<typeof lineSchema>;
export type LinePayload = z.output<typeof lineSchema>;
