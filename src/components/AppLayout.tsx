import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { LanguageToggle } from "./LanguageToggle";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/auth/useAuth";

export function AppLayout() {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1">
        <header className="flex justify-end items-center gap-3 p-3 border-b">
          <LanguageToggle />
          <button
            type="button"
            className="text-xs opacity-70 hover:opacity-100"
            onClick={() => void signOut()}
          >
            {t("auth.signOut")}
          </button>
        </header>
        <main className="p-6"><Outlet /></main>
      </div>
    </div>
  );
}
