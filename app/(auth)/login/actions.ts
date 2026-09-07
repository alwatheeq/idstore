"use server";

import { redirect } from "next/navigation";
import { mobileAuthEmail, normalizeMobile } from "@/lib/auth/mobile";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error: string | null };

export async function signIn(_previousState: LoginState, formData: FormData): Promise<LoginState> {
  const dialCode = String(formData.get("dialCode") ?? "");
  const mobile = String(formData.get("mobile") ?? "");
  const pin = String(formData.get("pin") ?? "");

  if (!/^\d{6}$/.test(pin)) return { error: "Enter your six-digit PIN." };

  let email: string;
  try {
    email = mobileAuthEmail(normalizeMobile(dialCode, mobile));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Enter a valid mobile number." };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pin });
    if (error || !data.user) return { error: "Mobile number or PIN is incorrect." };

    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select("id")
      .eq("user_id", data.user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (membershipError) { await supabase.auth.signOut(); return { error: "This account is not active. Contact an administrator." }; }
    if (!membership) {
      const { data: portalIdentity } = await supabase.rpc("portal_identity");
      if (portalIdentity?.length) redirect("/portal");
      await supabase.auth.signOut();
      return { error: "This account is not active. Contact an administrator." };
    }
  } catch {
    return { error: "Sign-in is temporarily unavailable. Please try again." };
  }

  redirect("/work-orders");
}
