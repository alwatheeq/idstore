"use client";

import { useActionState } from "react";
import { createSimpleService } from "@/app/(app)/catalog/actions";
import { useUiLocale } from "@/components/ui-locale";

export type ServiceFormValues = { templateId: string; code: string; name: string; nameAr: string | null; orderType: string; price: number | null; minutes: number };
export function SimpleServiceForm({ initial }: { initial?: ServiceFormValues }) {
  const { pageText: t } = useUiLocale();
  const [state, action, pending] = useActionState(createSimpleService, { error: "" });
  return <form action={action} className="form-grid panel-body simple-service-form">
    {initial ? <input type="hidden" name="templateId" value={initial.templateId} /> : null}
    <div className="form-field"><span className="field-label">{t("Service ID")}</span><bdi dir="ltr">{initial?.code ?? t("Assigned automatically")}</bdi></div>
    <div className="form-field"><label htmlFor="service-order-type">{t("Work order type")}</label><select id="service-order-type" name="orderType" defaultValue={initial?.orderType ?? "maintenance"} disabled={Boolean(initial)}><option value="maintenance">{t("Maintenance")}</option><option value="bodyshop">{t("Bodyshop")}</option></select>{initial ? <input type="hidden" name="orderType" value={initial.orderType} /> : null}</div>
    <div className="form-field form-span-2"><label htmlFor="service-name">{t("Description")}</label><input id="service-name" name="name" maxLength={160} required defaultValue={initial?.name} placeholder={t("e.g. Brake pad replacement")} autoComplete="off" /></div>
    <div className="form-field form-span-2"><label htmlFor="service-name-ar">{t("Arabic description (optional)")}</label><input id="service-name-ar" name="nameAr" maxLength={160} dir="rtl" defaultValue={initial?.nameAr ?? ""} /></div>
    <details className="service-options form-span-2"><summary>{t("Price and time (optional)")}</summary><div className="form-grid">
      <div className="form-field"><label htmlFor="service-price">{t("Service price (JOD)")}</label><input id="service-price" name="customerPrice" type="number" min="0" max="999999.999" step="0.001" inputMode="decimal" dir="ltr" defaultValue={initial?.price ?? ""} /><small className="field-help">{t("Leave blank to price each work order separately.")}</small></div>
      <div className="form-field"><label htmlFor="service-minutes">{t("Estimated time (minutes)")}</label><input id="service-minutes" name="estimatedMinutes" type="number" min="1" max="1440" step="1" inputMode="numeric" dir="ltr" defaultValue={initial?.minutes || ""} /></div>
    </div></details>
    {state.error ? <p className="form-span-2 text-danger" role="alert">{t(state.error)}</p> : null}
    <div className="form-actions form-span-2"><button className="button primary" type="submit" disabled={pending}>{t(pending ? "Saving…" : "Save service")}</button></div>
  </form>;
}
