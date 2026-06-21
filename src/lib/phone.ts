/** Canonical digits-only form of a phone number (drops spaces, dashes, parens, leading +). */
export function normalizePhone(phone: string): string {
  return (phone ?? "").replace(/[^\d]/g, "");
}

/**
 * Deterministic synthetic email used as the Supabase auth identifier for a phone login.
 * The domain MUST use a real TLD — Supabase Auth (GoTrue) rejects made-up TLDs like
 * `.idstore` with `email_address_invalid`, which is why this is `portal.idstore.com`.
 * No mail is ever sent (email confirmation is off); the address is just an identifier.
 */
export function phoneToEmail(phone: string): string {
  const digits = normalizePhone(phone);
  if (!digits) throw new Error("Phone number has no digits");
  return `${digits}@portal.idstore.com`;
}
