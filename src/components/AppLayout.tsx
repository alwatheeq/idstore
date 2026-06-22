import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { LanguageToggle } from "./LanguageToggle";
import { BranchSwitcher } from "@/features/branches/BranchSwitcher";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/auth/useAuth";

export function AppLayout() {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-end gap-3 border-b border-line bg-paper/80 px-6 py-3 backdrop-blur-md">
          <BranchSwitcher />
          <LanguageToggle />
          <button
            type="button"
            className="rounded-full px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-paper-2 hover:text-ink"
            onClick={() => void signOut()}
          >
            {t("auth.signOut")}
          </button>
        </header>
        <main className="flex-1 px-6 py-8 lg:px-10">
          <div className="mx-auto max-w-6xl animate-fade-up">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
