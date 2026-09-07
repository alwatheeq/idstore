"use client";

import Link from "next/link";
import { useUiLocale } from "@/components/ui-locale";

export type ServiceSummary = { id: string; templateId?: string; code?: string; orderType?: string; name: string; nameAr: string | null; price: number | null; minutes: number; status: string };

export function ServiceList({ services, canEdit = false }: { services: ServiceSummary[]; canEdit?: boolean }) {
  const { locale, pageText: t } = useUiLocale();
  const money = new Intl.NumberFormat("en-JO", { style: "currency", currency: "JOD" });
  return <section className="panel"><div className="panel-header"><div><div className="panel-title">{t("Services")}</div><div className="panel-subtitle">{t("Define service IDs and descriptions for Maintenance and Bodyshop orders.")}</div></div><span className="status-pill gray" dir="ltr">{services.length}</span></div>
    {services.length ? <div className="simple-service-list">{services.map(service => <article className="simple-service-row" key={service.id}>
      <div className="simple-service-name"><bdi dir="ltr">{service.code}</bdi><strong>{locale === "ar" ? service.nameAr || service.name : service.name}</strong><span>{t(service.orderType === "bodyshop" ? "Bodyshop" : "Maintenance")} · {t(service.status === "published" ? "Ready for selection" : "Draft")}</span></div>
      <div><span className="field-label">{t("Service price (JOD)")}</span><strong dir="ltr">{service.price === null ? t("Not set") : money.format(service.price)}</strong></div>
      <div><span className="field-label">{t("Estimated time (minutes)")}</span><strong dir="ltr">{service.minutes || "—"}</strong></div>
      <Link className="button compact" href={canEdit && service.templateId ? `/catalog?new=service&service=${service.templateId}#service-form` : `/catalog?tab=advanced&version=${service.id}#service-version-${service.id}`}>{t(canEdit && service.templateId ? "Edit" : "Details")}</Link>
    </article>)}</div> : <div className="panel-body"><p>{t("No services configured for this order type.")}</p></div>}
  </section>;
}
