"use client";

import Link from "next/link";
import { useUiLocale } from "@/components/ui-locale";

export type ServiceSummary = { id: string; name: string; nameAr: string | null; price: number | null; minutes: number; status: string };

export function ServiceList({ services }: { services: ServiceSummary[] }) {
  const { locale, pageText: t } = useUiLocale();
  const money = new Intl.NumberFormat("en-JO", { style: "currency", currency: "JOD" });
  return <section className="panel"><div className="panel-header"><div><div className="panel-title">{t("Services")}</div><div className="panel-subtitle">{t("Name, price and estimated time in one place.")}</div></div><span className="status-pill gray" dir="ltr">{services.length}</span></div>
    {services.length ? <div className="simple-service-list">{services.map(service => <article className="simple-service-row" key={service.id}>
      <div className="simple-service-name"><strong>{locale === "ar" ? service.nameAr || service.name : service.name}</strong><span>{t(service.status === "published" ? "Ready for booking" : "Draft")}</span></div>
      <div><span className="field-label">{t("Service price (JOD)")}</span><strong dir="ltr">{service.price === null ? t("Not set") : money.format(service.price)}</strong></div>
      <div><span className="field-label">{t("Estimated time (minutes)")}</span><strong dir="ltr">{service.minutes || "—"}</strong></div>
      <Link className="button compact" href={`/catalog?tab=advanced&version=${service.id}#service-version-${service.id}`}>{t("Details")}</Link>
    </article>)}</div> : <div className="panel-body"><p>{t("No services yet. Add a name, price and estimated time to get started.")}</p></div>}
  </section>;
}
