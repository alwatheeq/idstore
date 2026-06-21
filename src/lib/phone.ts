/** Canonical digits-only form of a phone number (drops spaces, dashes, parens, leading +). */
export function normalizePhone(phone: string): string {
  return (phone ?? "").replace(/[^\d]/g, "");
}

/** Deterministic synthetic email used as the Supabase auth identifier for a phone login. */
export function phoneToEmail(phone: string): string {
  const digits = normalizePhone(phone);
  if (!digits) throw new Error("Phone number has no digits");
  return `${digits}@portal.idstore`;
}
