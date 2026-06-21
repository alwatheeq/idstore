import { Outlet, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useAuth } from "@/auth/useAuth";

export function PortalLayout() {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between gap-3 p-4 border-b">
        <Link to="/portal" className="font-extrabold">
          ⚡ {t("portal.title")}
        </Link>
        <div className="flex items-center gap-3">
          <LanguageToggle />
          <button
            type="button"
            className="text-xs opacity-70 hover:opacity-100"
            onClick={() => void signOut()}
          >
            {t("portal.signOut")}
          </button>
        </div>
      </header>
      <main className="p-4 sm:p-6 max-w-3xl mx-auto">
        <Outlet />
      </main>
    </div>
  );
}
