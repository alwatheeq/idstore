"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Bell, Boxes, Building2, CalendarDays, CarFront, CircleDollarSign,
  ClipboardList, Gauge, Menu, ShieldCheck, Users, UserRoundCog, X,
} from "lucide-react";
import { branches } from "@/lib/demo-data";

const navigation = [
  { href: "/dashboard", label: "Control room", icon: Gauge },
  { href: "/work-orders", label: "Work orders", icon: ClipboardList },
  { href: "/appointments", label: "Appointments", icon: CalendarDays },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/vehicles", label: "Vehicles", icon: CarFront },
  { href: "/inventory", label: "Parts & stock", icon: Boxes },
  { href: "/invoices", label: "Billing", icon: CircleDollarSign },
];

const administration = [
  { href: "/branches", label: "Branches", icon: Building2 },
  { href: "/staff", label: "Staff & access", icon: UserRoundCog },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isArabic, setIsArabic] = useState(false);

  useEffect(() => {
    document.documentElement.dir = isArabic ? "rtl" : "ltr";
    document.documentElement.lang = isArabic ? "ar" : "en";
  }, [isArabic]);

  const navGroup = (items: typeof navigation) => items.map(({ href, label, icon: Icon }) => (
    <Link className={`nav-item ${pathname.startsWith(href) ? "active" : ""}`} href={href} key={href} onClick={() => setMenuOpen(false)}>
      <Icon /> <span>{label}</span>
    </Link>
  ));

  return (
    <div className="app-frame">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="brand"><div className="brand-mark">ID</div><div><div className="brand-name">IDstore</div><div className="brand-sub">Service operations</div></div></div>
        <div className="nav-label">Workshop</div>
        <nav className="nav-list">{navGroup(navigation)}</nav>
        <div className="nav-label">Administration</div>
        <nav className="nav-list">{navGroup(administration)}</nav>
        <div className="sidebar-footer">
          <div className="safety-note"><strong><ShieldCheck size={14} /> HV safety enabled</strong>Quarantine, permit and qualification controls are active.</div>
        </div>
      </aside>
      <main className="app-main">
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label="Toggle menu" onClick={() => setMenuOpen((value) => !value)}>{menuOpen ? <X size={17} /> : <Menu size={17} />}</button>
          <div className="branch-select"><label htmlFor="branch">Operating branch</label><select id="branch" defaultValue="all"><option value="all">All branches</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.city} · {branch.code}</option>)}</select></div>
          <div className="topbar-spacer" />
          <button className="icon-button locale-button" onClick={() => setIsArabic((value) => !value)}>{isArabic ? "EN" : "العربية"}</button>
          <button className="icon-button notification" aria-label="Notifications"><Bell size={16} /></button>
          <div className="user-chip"><div className="avatar">MA</div><div className="user-copy"><strong>Moatasem A.</strong><span>Administrator</span></div></div>
        </header>
        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}
