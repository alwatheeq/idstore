import { AppShell } from "@/components/app-shell";
import { getCurrentStaff } from "@/lib/auth/session";
import { getActiveBranches } from "@/lib/auth/branches";
import { cookies } from "next/headers";
import { uiLocaleCookie, type UiLocale } from "@/lib/i18n/ui";

export default async function ApplicationLayout({ children }: { children: React.ReactNode }) {
  const staff = await getCurrentStaff();
  const cookieStore = await cookies();
  const locale: UiLocale = cookieStore.get(uiLocaleCookie)?.value === "ar" ? "ar" : "en";
  const branches = await getActiveBranches(staff.organizationId);

  return <AppShell staff={staff} initialLocale={locale} branches={(branches ?? []).map((branch) => ({
    id: branch.id,
    code: branch.code,
    city: branch.city,
    displayName: branch.display_name,
  }))}>{children}</AppShell>;
}
