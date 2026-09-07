"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftRight, Banknote, BarChart3, BookOpenCheck, Boxes, Building2, CalendarDays,
  CarFront, ChevronDown, CircleDollarSign, ClipboardCheck, ClipboardList, FileText,
  Gauge, Layers3, LogOut, Menu, Megaphone, PackageOpen, Paperclip, PlugZap, Plus, ScanLine,
  KeyRound, Search, Settings2, ShoppingCart, Sparkles, UserRoundCog, Users, Wrench, X,
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
  const pageModule = pathname.split("/").filter(Boolean)[0] ?? "dashboard";
  const router = useRouter();
  const { locale, setLocale, t } = useUiLocale();
  const [menuOpen, setMenuOpen] = useState(false);
  const [branchPending, setBranchPending] = useState(false);
  const [branchError, setBranchError] = useState(false);
  const navigationRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const groups = visibleNavigationGroups(staff.role, staff.permissionCodes);
  const visibleRoutes = new Set(groups.flatMap(group => group.items.map(item => item.href)));
  const canCreateOrder = staff.role === "admin" || staff.permissionCodes.includes("repair_order.manage");

  useEffect(() => {
    if (!menuOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const mobile = window.matchMedia("(max-width: 780px)");
    const navigation = navigationRef.current;
    const main = mainRef.current;
    if (!mobile.matches || !navigation || !main) return;
    main.inert = true;
    navigation.querySelector<HTMLButtonElement>(".sidebar-close")?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
      if (event.key !== "Tab") return;
      const controls = [...navigation.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), summary, select:not(:disabled), input:not(:disabled)')]
        .filter(element => element.getClientRects().length > 0);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const closeOnDesktop = () => { if (!mobile.matches) setMenuOpen(false); };
    mobile.addEventListener("change", closeOnDesktop);
    document.addEventListener("keydown", closeOnEscape);
    document.body.classList.add("nav-open");
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.classList.remove("nav-open");
      mobile.removeEventListener("change", closeOnDesktop);
      main.inert = false;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [menuOpen]);

  async function selectOperatingBranch(branchId: string) {
    setBranchPending(true);
    setBranchError(false);
    try {
      const response = await fetch("/api/operating-branch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ branchId: branchId === "all" ? null : branchId }),
      });
      if (!response.ok) throw new Error("Operating branch could not be changed.");
      router.refresh();
    } catch {
      setBranchError(true);
    } finally {
      setBranchPending(false);
    }
  }

  return (
    <div className="app-frame">
      <a className="skip-content" href="#main-content">{t("Skip to content")}</a>
      <button className={`nav-backdrop ${menuOpen ? "visible" : ""}`} type="button" tabIndex={-1} aria-hidden="true" aria-label={t("Close menu")} onClick={() => setMenuOpen(false)} />
      <aside ref={navigationRef} className={`sidebar ${menuOpen ? "open" : ""}`} id="primary-navigation" role={menuOpen ? "dialog" : undefined} aria-modal={menuOpen ? true : undefined} aria-label={t("Service operations")}>
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
              <details className={`nav-group ${containsActiveRoute ? "active-group" : ""}`} key={group.key} open={containsActiveRoute || groupIndex < 2 ? true : undefined}>
                <summary><GroupIcon /><span>{t(group.label)}</span><b className="nav-group-count mono" aria-hidden="true">{group.items.length}</b><ChevronDown className="nav-chevron" /></summary>
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
          <div className="sidebar-account">
            <div className="avatar" aria-hidden="true">{initials(staff.displayName)}</div>
            <div className="user-copy"><strong>{staff.displayName}</strong><span>{t(staff.role === "admin" ? "Administrator" : "Staff")}</span></div>
            <form action="/auth/signout" method="post"><button className="sidebar-signout" type="submit" aria-label={t("Sign out")}><LogOut /><span>{t("Sign out")}</span></button></form>
          </div>
        </div>
      </aside>

      <main ref={mainRef} className="app-main" id="main-content" tabIndex={-1}>
        <header className="topbar">
          <button className="icon-button mobile-menu" type="button" aria-label={t(menuOpen ? "Close navigation" : "Open navigation")} aria-controls="primary-navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>{menuOpen ? <X /> : <Menu />}</button>
          <div className="branch-select"><label htmlFor="branch">{t("Operating branch")}</label><select id="branch" value={staff.selectedBranchId ?? "all"} disabled={branchPending || !branches.length} onChange={(event) => void selectOperatingBranch(event.target.value)}><option value="all">{t(branches.length ? "All branches" : "No branches configured")}</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.city} · {branch.code}</option>)}</select></div>
          <form className="topbar-search" action="/search"><Search aria-hidden="true" /><input name="q" aria-label={t("Global search")} placeholder={t("Search VIN, RO, customer…")} /></form>
          <div className="topbar-spacer" />
          <button className="icon-button locale-button" type="button" aria-label={t(locale === "ar" ? "Change language to English" : "Change language to Arabic")} onClick={() => setLocale(locale === "ar" ? "en" : "ar")}>{locale === "ar" ? "EN" : "عربي"}</button>
          <div className="user-chip"><div className="avatar" aria-hidden="true">{initials(staff.displayName)}</div><div className="user-copy"><strong>{staff.displayName}</strong><span>{t(staff.role === "admin" ? "Administrator" : "Staff")}</span></div></div>
          <form className="topbar-signout-form" action="/auth/signout" method="post"><button className="icon-button signout-button" type="submit" title={t("Sign out")} aria-label={t("Sign out")}><LogOut /></button></form>
        </header>
        {branchError ? <div className="branch-error" role="alert">{t("Could not change branch. Please try again.")}</div> : null}
        <div className="page-content" data-module={pageModule}><LocalizedContent>{children}</LocalizedContent></div>
        <nav className="touch-dock" aria-label={t("Quick navigation")}>
          <Link className={`touch-dock-item ${pathname.startsWith("/dashboard") ? "active" : ""}`} aria-current={pathname.startsWith("/dashboard") ? "page" : undefined} href="/dashboard"><Gauge aria-hidden="true" /><span>{t("Home")}</span></Link>
          {visibleRoutes.has("/appointments") ? <Link className={`touch-dock-item ${pathname.startsWith("/appointments") ? "active" : ""}`} aria-current={pathname.startsWith("/appointments") ? "page" : undefined} href="/appointments"><CalendarDays aria-hidden="true" /><span>{t("Visits")}</span></Link> : null}
          {canCreateOrder ? <Link className="touch-dock-primary" href="/work-orders?new=1#new-work-order" aria-label={t("Open work order")}><Plus aria-hidden="true" /><span>{t("New order")}</span></Link> : null}
          {visibleRoutes.has("/work-orders") ? <Link className={`touch-dock-item ${pathname.startsWith("/work-orders") ? "active" : ""}`} aria-current={pathname.startsWith("/work-orders") ? "page" : undefined} href="/work-orders"><ClipboardList aria-hidden="true" /><span>{t("Workshop")}</span></Link> : null}
          <button className={`touch-dock-item ${menuOpen ? "active" : ""}`} type="button" aria-label={t("Open navigation")} aria-controls="primary-navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}><Menu aria-hidden="true" /><span>{t("More")}</span></button>
        </nav>
      </main>
    </div>
  );
}
