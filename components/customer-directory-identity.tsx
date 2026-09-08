"use client";

import Link from "next/link";
import { CircleCheck, CircleX, Phone } from "lucide-react";
import { useUiLocale } from "@/components/ui-locale";

type Contact = { kind: string; value: string; normalized_value: string | null; is_primary: boolean };

export function CustomerDirectoryStatus({ active, label, href }: { active: boolean; label?: string; href?: string }) {
  const { pageText: t } = useUiLocale();
  const title = t(label ?? (active ? "Active" : "Disabled"));
  const Icon = active ? CircleCheck : CircleX;
  const className = `customer-directory-status ${active ? "is-active" : "is-disabled"}`;
  if (href) return <Link className={className} href={href} title={`${title} · ${t("Enable portal")}`} aria-label={`${title} · ${t("Enable portal")}`}><Icon aria-hidden="true" /></Link>;
  return <span className={className} role="img" title={title} aria-label={title}><Icon aria-hidden="true" /></span>;
}

export function CustomerDirectoryIdentity({ id, name, type, status, contacts }: { id: string; name: string; type: string; status: string; contacts: Contact[] }) {
  const { pageText: t } = useUiLocale();
  const phones = contacts.filter(contact => contact.kind === "mobile" || contact.kind === "phone");
  const phone = phones.find(contact => contact.is_primary) ?? phones[0];
  const dial = (phone?.normalized_value || phone?.value || "").replace(/[\s().-]/g, "").replace(/^00/, "+");
  const canCall = /^\+?[0-9]{5,15}$/.test(dial);
  const statusLabel = status === "active" ? "Active" : status === "archived" ? "Archived" : status === "restricted" ? "Restricted" : status === "anonymized" ? "Anonymized" : "Disabled";
  return <div className="customer-directory-identity">
    <div className="customer-directory-name"><Link href={`/customers?manage=${id}#customer-controls`}><bdi>{name}</bdi></Link><CustomerDirectoryStatus active={status === "active"} label={statusLabel} /></div>
    {phone ? canCall ? <a className="customer-directory-phone" href={`tel:${dial}`} aria-label={`${t("Call")}: ${phone.value}`}><Phone aria-hidden="true" /><bdi dir="ltr">{phone.value}</bdi></a> : <span className="customer-directory-phone"><bdi dir="ltr">{phone.value}</bdi></span> : null}
    <span className="cell-sub">{t(type === "company" ? "Fleet account" : "Individual")}</span>
  </div>;
}
