"use client";

import { useMemo, useState } from "react";
import { CheckCheck, ListChecks } from "lucide-react";
import { addInspectionCatalogItems } from "@/app/(app)/inspections/actions";
import { useUiLocale } from "@/components/ui-locale";

export type InspectionCheckOption = {
  id: string;
  code: string;
  category: string;
  labelEn: string;
  labelAr: string;
  required: boolean;
  modelSpecific: boolean;
};

const categoryLabels: Record<string, string> = {
  identity: "Identity",
  hv_battery: "HV battery",
  charging: "Charging",
  exterior: "Exterior",
  tyres_brakes: "Tyres and brakes",
  underbody: "Underbody",
  cabin: "Cabin",
  electronics: "Electronics",
  road_test: "Road test",
};

export function InspectionCheckLabel({ labelEn, labelAr }: { labelEn: string; labelAr?: string }) {
  const { locale } = useUiLocale();
  return <>{locale === "ar" && labelAr ? labelAr : labelEn}</>;
}

export function InspectionCheckMatrix({ inspectionId, checks }: { inspectionId: string; checks: InspectionCheckOption[] }) {
  const { locale, pageText } = useUiLocale();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const requiredIds = useMemo(() => checks.filter((check) => check.required).map((check) => check.id), [checks]);

  function select(ids: string[]) {
    setSelected(new Set(ids));
  }

  return <section className="inspection-matrix-panel">
    <div className="inspection-matrix-toolbar">
      <div><span className="inspection-matrix-icon"><ListChecks /></span><strong>Checklist matrix</strong><small>Select completed checks, then save them together.</small></div>
      <div className="inline-actions"><button className="button compact" type="button" onClick={() => select(requiredIds)}>Select required</button><button className="button compact" type="button" onClick={() => select(checks.map((check) => check.id))}>Select all</button>{selected.size ? <button className="button compact" type="button" onClick={() => select([])}>Clear</button> : null}</div>
    </div>
    {checks.length ? <form action={addInspectionCatalogItems}>
      <input type="hidden" name="inspectionId" value={inspectionId} />
      <div className="inspection-check-grid">
        {checks.map((check) => <article className={`inspection-check-card ${selected.has(check.id) ? "selected" : ""}`} key={check.id}>
          <label><input type="checkbox" name="checkDefinitionId" value={check.id} checked={selected.has(check.id)} onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(check.id); else next.delete(check.id); return next; })} /><span><b>{locale === "ar" ? check.labelAr : check.labelEn}</b><small>{pageText(categoryLabels[check.category] ?? check.category)} · {check.modelSpecific ? pageText("Model specific") : pageText("Standard")}</small></span></label>
          <label className="form-field labeled-control"><span className="field-label">{pageText("Result")}</span><select name={`checkResult:${check.id}`} defaultValue="pass" aria-label={`${locale === "ar" ? check.labelAr : check.labelEn} ${pageText("result")}`}><option value="pass">Pass</option><option value="not_applicable">Not applicable</option></select></label>
          {check.required ? <em>Required</em> : <em className="optional">Optional</em>}
        </article>)}
      </div>
      <div className="inspection-matrix-actions"><span><strong className="mono">{selected.size}</strong> selected · exceptions use the detailed check below</span><button className="button primary" type="submit" disabled={!selected.size}><CheckCheck /> Save selected</button></div>
    </form> : <div className="table-empty">All applicable catalog checks are recorded.</div>}
  </section>;
}
