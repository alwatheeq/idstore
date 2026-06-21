import { z } from "zod";

/** Trim; empty/whitespace-only → null; else the trimmed string. */
const optionalText = z
  .string()
  .optional()
  .transform((v): string | null => {
    if (v === undefined) return null;
    const t = v.trim();
    return t.length === 0 ? null : t;
  });

export const softwareUpdateSchema = z.object({
  to_version: z.string().min(1, "Version is required"),
  from_version: optionalText,
  applied_at: z.string().min(1, "Date is required"),
  notes: optionalText,
  service_order_id: optionalText,
});

export type SoftwareUpdateFormValues = z.input<typeof softwareUpdateSchema>;
export type SoftwareUpdatePayload = z.output<typeof softwareUpdateSchema>;
