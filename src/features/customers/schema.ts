import { z } from "zod";

/**
 * Converts an optional string field: trims whitespace; empty/whitespace-only
 * becomes null; otherwise returns the trimmed string.
 */
const optionalText = z
  .string()
  .optional()
  .transform((v): string | null => {
    if (v === undefined) return null;
    const t = v.trim();
    return t.length === 0 ? null : t;
  });

/**
 * Accepts a string or number; blank/undefined → null; numeric string → integer;
 * non-numeric or non-finite input → validation error.
 */
const optionalInt = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v, ctx): number | null => {
    if (v === undefined) return null;
    if (typeof v === "string") {
      const trimmed = v.trim();
      if (trimmed.length === 0) return null;
      const n = Number(trimmed);
      if (!Number.isFinite(n)) {
        ctx.addIssue("Must be a valid integer");
        return z.NEVER;
      }
      return Math.trunc(n);
    }
    // v is a number
    if (!Number.isFinite(v)) {
      ctx.addIssue("Must be a valid integer");
      return z.NEVER;
    }
    return Math.trunc(v);
  });

/**
 * Email field: empty/whitespace → null; non-empty must be valid email.
 */
const optionalEmail = z
  .string()
  .optional()
  .transform((v, ctx): string | null => {
    if (v === undefined) return null;
    const t = v.trim();
    if (t.length === 0) return null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(t)) {
      ctx.addIssue("Invalid email");
      return z.NEVER;
    }
    return t;
  });

export const customerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: optionalText,
  email: optionalEmail,
  notes: optionalText,
});

export const vehicleSchema = z.object({
  plate_number: optionalText,
  vin: optionalText,
  model: optionalText,
  model_year: optionalInt,
  color: optionalText,
  current_odometer: optionalInt,
  hv_battery_state: optionalText,
  software_version: optionalText,
  notes: optionalText,
});

export type CustomerFormValues = z.input<typeof customerSchema>;
export type CustomerPayload = z.output<typeof customerSchema>;
export type VehicleFormValues = z.input<typeof vehicleSchema>;
export type VehiclePayload = z.output<typeof vehicleSchema>;
