"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Banknote, Bell, Boxes, Building2, CalendarDays, CarFront, CircleDollarSign,
  ArrowLeftRight, BarChart3, BookOpenCheck, ClipboardCheck, ClipboardList, FileText, Gauge, Menu, Megaphone, Paperclip, PlugZap, ScanLine, Search, ShieldCheck, ShoppingCart, Users, UserRoundCog, X,
} from "lucide-react";
import type { CurrentStaff } from "@/lib/auth/session";

const navigation = [
  { href: "/dashboard", label: "Control room", icon: Gauge },
  { href: "/work-orders", label: "Work orders", icon: ClipboardList },
  { href: "/inspections", label: "Inspections", icon: ClipboardCheck },
  { href: "/estimates", label: "Estimates", icon: FileText },
  { href: "/hv-safety", label: "HV safety", icon: ShieldCheck },
  { href: "/diagnostics", label: "Diagnostics", icon: ScanLine },
  { href: "/quality-campaigns", label: "Quality & campaigns", icon: Megaphone },
  { href: "/appointments", label: "Appointments", icon: CalendarDays },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/vehicles", label: "Vehicles", icon: CarFront },
  { href: "/inventory", label: "Parts & stock", icon: Boxes },
  { href: "/stock-control", label: "Transfers & counts", icon: ArrowLeftRight },
  { href: "/purchasing", label: "Purchasing", icon: ShoppingCart },
  { href: "/invoices", label: "Billing", icon: CircleDollarSign },
  { href: "/finance-control", label: "Finance controls", icon: Banknote },
  { href: "/records", label: "Files & messages", icon: Paperclip },
  { href: "/reports", label: "Reports", icon: BarChart3 },
];

const administration = [
  { href: "/catalog", label: "Catalog & capacity", icon: BookOpenCheck },
  { href: "/governance", label: "Integrations & audit", icon: PlugZap },
  { href: "/branches", label: "Branches", icon: Building2 },
  { href: "/staff", label: "Staff & access", icon: UserRoundCog },
];

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

type ShellBranch = { id: string; code: string; city: string; displayName: string };

export function AppShell({ children, staff, branches }: { children: React.ReactNode; staff: CurrentStaff; branches: ShellBranch[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isArabic, setIsArabic] = useState(false);
  const [branchPending, setBranchPending] = useState(false);

  useEffect(() => {
    document.documentElement.dir = isArabic ? "rtl" : "ltr";
    document.documentElement.lang = isArabic ? "ar" : "en";
  }, [isArabic]);

  const navGroup = (items: typeof navigation) => items.map(({ href, label, icon: Icon }) => (
    <Link className={`nav-item ${pathname.startsWith(href) ? "active" : ""}`} href={href} key={href} onClick={() => setMenuOpen(false)}>
      <Icon /> <span>{label}</span>
    </Link>
  ));

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
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="brand"><div className="brand-mark">ID</div><div><div className="brand-name">IDstore</div><div className="brand-sub">Service operations</div></div></div>
        <div className="nav-label">Workshop</div>
        <nav className="nav-list">{navGroup(navigation)}</nav>
        <div className="nav-label">Administration</div>
        <nav className="nav-list">{navGroup(staff.role === "admin" ? administration : administration.filter((item) => item.href !== "/staff"))}</nav>
        <div className="sidebar-footer">
          <div className="safety-note"><strong><ShieldCheck size={14} /> HV safety enabled</strong>Quarantine, permit and qualification controls are active.</div>
        </div>
      </aside>
      <main className="app-main">
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label="Toggle menu" onClick={() => setMenuOpen((value) => !value)}>{menuOpen ? <X size={17} /> : <Menu size={17} />}</button>
          <div className="branch-select"><label htmlFor="branch">Operating branch</label><select id="branch" value={staff.selectedBranchId ?? "all"} disabled={branchPending || !branches.length} onChange={(event) => void selectOperatingBranch(event.target.value)}><option value="all">{branches.length ? "All branches" : "No branches configured"}</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.city} · {branch.code}</option>)}</select></div>
          <form className="topbar-search" action="/search"><Search size={15} /><input name="q" aria-label="Global search" placeholder="Search VIN, RO, customer…" /></form>
          <div className="topbar-spacer" />
          <button className="icon-button locale-button" onClick={() => setIsArabic((value) => !value)}>{isArabic ? "EN" : "العربية"}</button>
          <button className="icon-button notification" aria-label="Notifications"><Bell size={16} /></button>
          <div className="user-chip"><div className="avatar">{initials(staff.displayName)}</div><div className="user-copy"><strong>{staff.displayName}</strong><span>{staff.role === "admin" ? "Administrator" : "Staff"}</span></div></div>
        </header>
        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}
