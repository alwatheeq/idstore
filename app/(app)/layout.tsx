import { AppShell } from "@/components/app-shell";
import { getCurrentStaff } from "@/lib/auth/session";

export default async function ApplicationLayout({ children }: { children: React.ReactNode }) {
  const staff = await getCurrentStaff();
  return <AppShell staff={staff}>{children}</AppShell>;
}
