"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftRight, Banknote, BarChart3, BookOpenCheck, Boxes, Building2, CalendarDays,
  CarFront, ChevronDown, CircleDollarSign, ClipboardCheck, ClipboardList, FileText,
  Gauge, Layers3, LogOut, Menu, Megaphone, PackageOpen, Paperclip, PlugZap, ScanLine,
  KeyRound, Search, Settings2, ShieldCheck, ShoppingCart, Sparkles, UserRoundCog, Users, Wrench, X,
  type LucideIcon,
} from "lucide-react";
import type { CurrentStaff } from "@/lib/auth/session";
import { navigationGroups, visibleNavigationGroups } from "@/lib/navigation";
import type { UiLocale } from "@/lib/i18n/ui";
import { UiLocaleProvider, useUiLocale } from "@/components/ui-locale";
import { LocalizedContent } from "@/components/localized-content";

const routeIcons: Record<string, LucideIcon> = {
  "/dashboard": Gauge,
  "/work-orders": ClipboardList,
  "/inspections": ClipboardCheck,
  "/estimates": FileText,
  "/hv-safety": ShieldCheck,
  "/diagnostics": ScanLine,
  "/quality-campaigns": Megaphone,
  "/appointments": CalendarDays,
  "/customers": Users,
  "/vehicles": CarFront,
  "/inventory": Boxes,
  "/stock-control": ArrowLeftRight,
  "/purchasing": ShoppingCart,
  "/invoices": CircleDollarSign,
  "/finance-control": Banknote,
  "/records": Paperclip,
  "/reports": BarChart3,
  "/catalog": BookOpenCheck,
  "/governance": PlugZap,
  "/branches": Building2,
  "/staff": UserRoundCog,
  "/settings/access": KeyRound,
};

const groupIcons: Record<(typeof navigationGroups)[number]["key"], LucideIcon> = {
  overview: Sparkles,
  reception: Users,
  workshop: Wrench,
  parts: PackageOpen,
  commercial: Layers3,
  administration: Settings2,
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

type ShellBranch = { id: string; code: string; city: string; displayName: string };
type AppShellProps = {
  children: React.ReactNode;
  staff: CurrentStaff;
  branches: ShellBranch[];
  initialLocale: UiLocale;
};

export function AppShell(props: AppShellProps) {
  return (
    <UiLocaleProvider initialLocale={props.initialLocale}>
      <AppShellContent {...props} />
    </UiLocaleProvider>
  );
}

function AppShellContent({ children, staff, branches }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { locale, setLocale, t } = useUiLocale();
  const [menuOpen, setMenuOpen] = useState(false);
  const [branchPending, setBranchPending] = useState(false);
  const groups = visibleNavigationGroups(staff.role, staff.permissionCodes);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    document.body.classList.add("nav-open");
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.classList.remove("nav-open");
    };
  }, [menuOpen]);

  async function selectOperatingBranch(branchId: string) {
    setBranchPending(true);
    try {
      const response = await fetch("/api/operating-branch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ branchId: branchId === "all" ? null : branchId }),
      });
      if (!response.ok) throw new Error("Operating branch could not be changed.");
      router.refresh();
    } finally {
      setBranchPending(false);
    }
  }

  return (
    <div className="app-frame">
      <button className={`nav-backdrop ${menuOpen ? "visible" : ""}`} type="button" aria-label={t("Close menu")} onClick={() => setMenuOpen(false)} />
      <aside className={`sidebar ${menuOpen ? "open" : ""}`} id="primary-navigation" aria-label={t("Service operations")}>
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">ID</div>
          <div className="brand-copy">
            <div className="brand-name">IDstore</div>
            <div className="brand-sub">{t("Service operations")}</div>
          </div>
          <button className="sidebar-close" type="button" aria-label={t("Close navigation")} onClick={() => setMenuOpen(false)}><X /></button>
        </div>
        <div className="energy-signature" aria-hidden="true"><span /><span /><span /><span /></div>
        <div className="network-label">{t("MEB service network")}</div>

        <nav className="grouped-navigation">
          {groups.map((group, groupIndex) => {
            const GroupIcon = groupIcons[group.key];
            const containsActiveRoute = group.items.some((item) => pathname.startsWith(item.href));
            return (
              <details className="nav-group" key={group.key} open={containsActiveRoute || groupIndex < 2 ? true : undefined}>
                <summary><GroupIcon /><span>{t(group.label)}</span><ChevronDown className="nav-chevron" /></summary>
                <div className="nav-list">
                  {group.items.map(({ href, label }) => {
                    const Icon = routeIcons[href];
                    const isActive = pathname.startsWith(href);
                    return (
                      <Link className={`nav-item ${isActive ? "active" : ""}`} aria-current={isActive ? "page" : undefined} href={href} key={href} onClick={() => setMenuOpen(false)}>
                        <Icon aria-hidden="true" /><span>{t(label)}</span>
                      </Link>
                    );
                  })}
                </div>
              </details>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="safety-note"><strong><ShieldCheck /> {t("HV safety enabled")}</strong><span>{t("Quarantine, permit and qualification controls are active.")}</span></div>
          <div className="sidebar-account">
            <div className="avatar" aria-hidden="true">{initials(staff.displayName)}</div>
            <div className="user-copy"><strong>{staff.displayName}</strong><span>{t(staff.role === "admin" ? "Administrator" : "Staff")}</span></div>
            <form action="/auth/signout" method="post"><button className="sidebar-signout" type="submit" aria-label={t("Sign out")}><LogOut /><span>{t("Sign out")}</span></button></form>
          </div>
        </div>
      </aside>

      <main className="app-main">
        <header className="topbar">
          <button className="icon-button mobile-menu" type="button" aria-label={t(menuOpen ? "Close navigation" : "Open navigation")} aria-controls="primary-navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>{menuOpen ? <X /> : <Menu />}</button>
          <div className="branch-select"><label htmlFor="branch">{t("Operating branch")}</label><select id="branch" value={staff.selectedBranchId ?? "all"} disabled={branchPending || !branches.length} onChange={(event) => void selectOperatingBranch(event.target.value)}><option value="all">{t(branches.length ? "All branches" : "No branches configured")}</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.city} · {branch.code}</option>)}</select></div>
          <form className="topbar-search" action="/search"><Search aria-hidden="true" /><input name="q" aria-label={t("Global search")} placeholder={t("Search VIN, RO, customer…")} /></form>
          <div className="topbar-spacer" />
          <button className="icon-button locale-button" type="button" aria-label={t(locale === "ar" ? "Change language to English" : "Change language to Arabic")} onClick={() => setLocale(locale === "ar" ? "en" : "ar")}>{locale === "ar" ? "EN" : "عربي"}</button>
          <div className="user-chip"><div className="avatar" aria-hidden="true">{initials(staff.displayName)}</div><div className="user-copy"><strong>{staff.displayName}</strong><span>{t(staff.role === "admin" ? "Administrator" : "Staff")}</span></div></div>
          <form className="topbar-signout-form" action="/auth/signout" method="post"><button className="icon-button signout-button" type="submit" title={t("Sign out")} aria-label={t("Sign out")}><LogOut /></button></form>
        </header>
        <div className="page-content"><LocalizedContent>{children}</LocalizedContent></div>
      </main>
    </div>
  );
}
