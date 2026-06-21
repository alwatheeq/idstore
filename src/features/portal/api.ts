import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { phoneToEmail } from "@/lib/phone";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

/**
 * Create a portal auth account for a customer and link it. Uses a throwaway client
 * (persistSession:false) so the admin's session is NOT replaced by the new signUp.
 * Requires "Confirm email" OFF in Supabase Auth. Throws on failure.
 */
export async function provisionPortalLogin(customerId: string, phone: string, pin: string): Promise<void> {
  const email = phoneToEmail(phone);
  const tmp = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await tmp.auth.signUp({ email, password: pin });
  if (error) throw error;
  const newUserId = data.user?.id;
  if (!newUserId) throw new Error("Sign-up did not return a user");
  const { error: linkError } = await supabase.from("customers").update({ auth_user_id: newUserId }).eq("id", customerId);
  if (linkError) throw linkError;
}

/** Change the CURRENT (logged-in customer's) PIN. */
export async function changePin(newPin: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPin });
  if (error) throw error;
}
