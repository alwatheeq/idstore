import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";

const items = [
  { to: "/", key: "dashboard", icon: "📊", end: true },
  { to: "/orders", key: "orders", icon: "🔧", end: false },
  { to: "/customers", key: "customers", icon: "👥", end: false },
  { to: "/invoices", key: "invoices", icon: "🧾", end: false },
  { to: "/settings", key: "settings", icon: "⚙️", end: false },
] as const;

export function Sidebar() {
  const { t } = useTranslation();
  return (
    <nav className="flex flex-col gap-1 p-3 w-52 border-e min-h-screen">
      <div className="px-2 py-3">
        <div className="font-extrabold">⚡ {t("app.name")}</div>
        <div className="text-xs opacity-60">{t("app.subtitle")}</div>
      </div>
      {items.map((it) => (
        <NavLink key={it.key} to={it.to} end={it.end}
          className={({ isActive }) =>
            `px-3 py-2 rounded-lg text-sm ${isActive ? "bg-blue-100 text-blue-700 font-semibold" : "opacity-80 hover:opacity-100"}`}>
          {it.icon} {t(`nav.${it.key}`)}
        </NavLink>
      ))}
    </nav>
  );
}
