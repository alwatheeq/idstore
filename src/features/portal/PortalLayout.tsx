import { Outlet, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useAuth } from "@/auth/useAuth";

export function PortalLayout() {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-paper/80 px-6 py-3 backdrop-blur-md">
        <Link to="/portal" className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-lg text-volt shadow-card">
            ⚡
          </span>
          <span className="font-bold tracking-tight text-ink">{t("portal.title")}</span>
        </Link>
        <div className="flex items-center gap-3">
          <LanguageToggle />
          <button
            type="button"
            className="rounded-full px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-paper-2 hover:text-ink"
            onClick={() => void signOut()}
          >
            {t("portal.signOut")}
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl animate-fade-up px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
