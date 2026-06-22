import { z } from "zod";

const opt = z
  .string()
  .optional()
  .transform((v): string | null => {
    const t = (v ?? "").trim();
    return t.length ? t : null;
  });

export const branchSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  code: opt,
  phone: opt,
  address: opt,
  is_active: z.boolean().default(true),
});

export type BranchFormValues = z.input<typeof branchSchema>;
export type BranchPayload = z.output<typeof branchSchema>;
