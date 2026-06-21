import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";

const icon = (path: ReactNode) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    {path}
  </svg>
);

const icons = {
  dashboard: icon(
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  orders: icon(
    <>
      <path d="M14.7 6.3a4 4 0 0 1-5 5L4 17l3 3 5.7-5.7a4 4 0 0 0 5-5l-2.3 2.3-2.1-.6-.6-2.1z" />
    </>
  ),
  customers: icon(
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.5a3 3 0 0 1 0 5.8M20.5 20a4.8 4.8 0 0 0-3.2-4.5" />
    </>
  ),
  invoices: icon(
    <>
      <path d="M6 3h9l4 4v12.5a1 1 0 0 1-1.5.85L15 19l-2 1.3L11 19l-2 1.3L7 19l-1.5.95A1 1 0 0 1 4 19V5a2 2 0 0 1 2-2z" />
      <path d="M8.5 9h7M8.5 12.5h7" />
    </>
  ),
  settings: icon(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v2M12 19.5v2M21.5 12h-2M4.5 12h-2M18.4 5.6l-1.4 1.4M7 17l-1.4 1.4M18.4 18.4 17 17M7 7 5.6 5.6" />
    </>
  ),
} as const;

const items = [
  { to: "/", key: "dashboard", end: true },
  { to: "/orders", key: "orders", end: false },
  { to: "/customers", key: "customers", end: false },
  { to: "/invoices", key: "invoices", end: false },
  { to: "/settings", key: "settings", end: false },
] as const;

export function Sidebar() {
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t("nav.main")}
      className="sticky top-0 flex h-screen w-60 shrink-0 flex-col gap-1 border-e bg-surface p-4"
    >
      <div className="mb-4 flex items-center gap-3 px-2 py-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-lg text-volt shadow-card">
          ⚡
        </span>
        <div className="leading-tight">
          <div className="font-bold tracking-tight text-ink">{t("app.name")}</div>
          <div className="micro mt-0.5">{t("app.subtitle")}</div>
        </div>
      </div>

      {items.map((it) => (
        <NavLink
          key={it.key}
          to={it.to}
          end={it.end}
          className={({ isActive }) =>
            `relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
              isActive
                ? "bg-paper-2 font-semibold text-ink before:absolute before:inset-y-2 before:start-0 before:w-1 before:rounded-full before:bg-volt before:content-['']"
                : "font-medium text-ink-2 hover:bg-paper-2 hover:text-ink"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span className={isActive ? "text-ink" : "text-muted"}>{icons[it.key]}</span>
              {t(`nav.${it.key}`)}
            </>
          )}
        </NavLink>
      ))}

      <div className="mt-auto px-3 pt-4">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2.5">
          <span className="h-2 w-2 rounded-full bg-volt shadow-volt" aria-hidden />
          <span className="micro">{t("app.subtitle")}</span>
        </div>
      </div>
    </nav>
  );
}
