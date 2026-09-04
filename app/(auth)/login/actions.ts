"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  let failure: string | null = null;
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    failure = error?.message ?? null;
  } catch (error) {
    failure = error instanceof Error ? error.message : "Unable to sign in";
  }

  if (failure) redirect(`/login?error=${encodeURIComponent(failure)}`);

  redirect("/dashboard");
}
