"use client";

import { useActionState } from "react";
import { createSimpleService } from "@/app/(app)/catalog/actions";
import { useUiLocale } from "@/components/ui-locale";

export function SimpleServiceForm() {
  const { pageText: t } = useUiLocale();
  const [state, action, pending] = useActionState(createSimpleService, { error: "" });
  return <form action={action} className="form-grid panel-body simple-service-form">
    <div className="form-field form-span-2"><label htmlFor="service-name">{t("Service name")}</label><input id="service-name" name="name" maxLength={160} required placeholder={t("e.g. Brake inspection")} autoComplete="off" /></div>
    <div className="form-field"><label htmlFor="service-price">{t("Service price (JOD)")}</label><input id="service-price" name="customerPrice" type="number" min="0" max="999999.999" step="0.001" inputMode="decimal" dir="ltr" required aria-describedby="service-price-help" /><small id="service-price-help" className="field-help">{t("Default customer charge. Final estimates and invoices are priced separately.")}</small></div>
    <div className="form-field"><label htmlFor="service-minutes">{t("Estimated time (minutes)")}</label><input id="service-minutes" name="estimatedMinutes" type="number" min="1" max="1440" step="1" inputMode="numeric" dir="ltr" defaultValue="60" required /><small className="field-help">{t("Used to plan the appointment and workshop time.")}</small></div>
    <details className="service-options form-span-2"><summary>{t("Additional details")}</summary><div className="form-field"><label htmlFor="service-name-ar">{t("Arabic name (optional)")}</label><input id="service-name-ar" name="nameAr" maxLength={160} dir="rtl" /></div></details>
    {state.error ? <p className="form-span-2 text-danger" role="alert">{t(state.error)}</p> : null}
    <div className="form-actions form-span-2"><button className="button primary" type="submit" disabled={pending}>{t(pending ? "Saving…" : "Save service")}</button></div>
  </form>;
}
