"use client";

import { useActionState } from "react";
import { useUiLocale } from "@/components/ui-locale";
import { selectInspectionServices } from "@/app/(app)/inspections/actions";

export function InspectionServicesForm({ inspectionId, services, selectedIds, canSelect }: {
  inspectionId: string; services: { id: string; code: string; name: string; nameAr: string | null }[];
  selectedIds: string[]; canSelect: boolean;
}) {
  const { locale, pageText: t } = useUiLocale();
  const [state, action, pending] = useActionState(selectInspectionServices, { error: "", success: false });
  return <form action={action} className="form-grid panel-body">
    <input type="hidden" name="inspectionId" value={inspectionId} />
    <fieldset className="form-span-2 concern-capture"><legend>{t("Services needed after inspection")}</legend>
      <p className="field-help">{t("Select the services needed to resolve the recorded findings. This does not approve charges.")}</p>
      <div className="concern-option-grid">{services.map(service => <label className="concern-option" key={service.id}>
        <input type="checkbox" name="serviceIds" value={service.id} defaultChecked={selectedIds.includes(service.id)} disabled={!canSelect || pending || selectedIds.includes(service.id)} />
        <span><bdi dir="ltr">{service.code}</bdi><br />{locale === "ar" ? service.nameAr || service.name : service.name}</span>
      </label>)}</div>
      {!services.length ? <p>{t("No services configured for this order type.")}</p> : null}
    </fieldset>
    {canSelect ? <><div className="form-field form-span-2"><label htmlFor={"service-selection-note-" + inspectionId}>{t("Finding / reason (optional)")}</label><textarea id={"service-selection-note-" + inspectionId} name="note" maxLength={2000} rows={2} /></div>
      <div className="form-actions form-span-2"><button className="button primary" type="submit" disabled={pending || !services.some(service => !selectedIds.includes(service.id))}>{t(pending ? "Saving…" : "Add selected services")}</button></div></> : <p className="field-help form-span-2">{t("Only the assigned technician or administrator can select services.")}</p>}
    {state.error ? <p role="alert" className="text-danger form-span-2">{t(state.error)}</p> : state.success ? <p role="status" className="form-span-2">{t("Services added to the work order.")}</p> : null}
  </form>;
}
