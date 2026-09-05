import { AppShell } from "@/components/app-shell";
import { getCurrentStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { uiLocaleCookie, type UiLocale } from "@/lib/i18n/ui";

export default async function ApplicationLayout({ children }: { children: React.ReactNode }) {
  const staff = await getCurrentStaff();
  const cookieStore = await cookies();
  const locale: UiLocale = cookieStore.get(uiLocaleCookie)?.value === "ar" ? "ar" : "en";
  const supabase = await createClient();
  const { data: branches } = await supabase
    .from("branches")
    .select("id, code, city, display_name")
    .eq("organization_id", staff.organizationId)
    .eq("status", "active")
    .order("city");

  return <AppShell staff={staff} initialLocale={locale} branches={(branches ?? []).map((branch) => ({
    id: branch.id,
    code: branch.code,
    city: branch.city,
    displayName: branch.display_name,
  }))}>{children}</AppShell>;
}
