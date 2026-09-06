"use client";

import { createContext, useActionState, useContext, useId, useState, type ReactNode } from "react";
import { useUiLocale } from "@/components/ui-locale";
import { checkCategories, checklistProgress, latestResult, problemGroups, recommendedIds, suggestedProblemGroups, type CheckDefinition, type CheckTask, type InspectionWorkspace, type VehicleModelOption } from "@/lib/inspection-workflow";
import { inspectionText, type InspectionCopyKey as Key } from "@/lib/i18n/inspection";

type SaveInspectionAction = (form: FormData) => Promise<{ error?: string; success?: boolean }>;
const InspectionSaveContext = createContext<SaveInspectionAction | null>(null);

function useText() { const { locale } = useUiLocale(); return { locale, t: (key: Key) => inspectionText(key, locale) }; }
function Field({ label, name, value, type = "text", required, children, wide, min, max }: { label: Key; name: string; value?: string | number | null; type?: string; required?: boolean; children?: ReactNode; wide?: boolean; min?: number; max?: number }) {
  const { t } = useText(); const id = useId();
  return <div className={`form-field${wide ? " form-span-2" : ""}`}><label htmlFor={id}>{t(label)}</label>{children ? <select id={id} name={name} defaultValue={value ?? ""} required={required}>{children}</select> : type === "textarea" ? <textarea id={id} name={name} defaultValue={value ?? ""} required={required} rows={3} maxLength={4000} /> : <input id={id} name={name} type={type} defaultValue={value ?? ""} required={required} min={min} max={max} maxLength={type === "number" || type === "date" ? undefined : 1000} dir={["number", "date"].includes(type) || ["code", "unit", "rule.unit", "rule.qualification"].includes(name) ? "ltr" : undefined} />}</div>;
}
function WorkflowForm({ action, inspectionId, children, button = "save", disabled, onSaved }: { action: string; inspectionId?: string; children: ReactNode; button?: Key; disabled?: boolean; onSaved?: () => void }) {
  const { locale, t } = useText(); const { pageText } = useUiLocale();
  const saveInspection = useContext(InspectionSaveContext);
  const [state, submit, pending] = useActionState(async (_previous: { error?: string; success?: boolean }, form: FormData) => {
    if (!saveInspection) return { error: "The inspection could not be saved." };
    const response = await saveInspection(form);
    if (response.success) onSaved?.();
    return response;
  }, {});
  const translatedError = state.error ? pageText(state.error) : "";
  return <form action={submit} className="form-grid iw-form">
    <input type="hidden" name="workflowAction" value={action} /><input type="hidden" name="inspectionId" value={inspectionId ?? ""} />
    <fieldset className="iw-fields" disabled={pending || disabled}>{children}</fieldset>
    {state.error ? <div className="iw-notice error form-span-2" role="alert">{locale === "ar" && translatedError === state.error ? t("error") : translatedError}</div> : state.success ? <p className="form-span-2" role="status">{t("saved")}</p> : null}
    <div className="form-actions form-span-2"><button className="button primary" type="submit" disabled={pending || disabled}>{t(pending ? "saving" : button)}</button></div>
  </form>;
}
function GroupInputs({ selected = [], prefix = "", }: { selected?: string[]; prefix?: string }) {
  const { t } = useText(); return <fieldset className="iw-groups form-span-2"><legend>{t("problem")}</legend>{problemGroups.map(group => <label key={group}><input type="checkbox" name={`${prefix}groups`} value={group} defaultChecked={selected.includes(group)} /><span>{t(group)}</span></label>)}</fieldset>;
}
function Assignment({ data, onSaved }: { data: InspectionWorkspace; onSaved: () => void }) {
  const { t } = useText(); const i = data.inspection!; const v = data.vehicle!; const a = i.assignment;
  const value = (key: string, fallback = "") => typeof a[key] === "string" ? a[key] as string : fallback;
  return <section className="iw-section">
    <div className="iw-vehicle-summary"><div><small>{t("model")}</small><strong>{v.model?.name ?? "—"}</strong></div><div><small>{t("year")}</small><strong dir="ltr">{v.model_year ?? "—"}</strong></div><div><small>VIN</small><strong dir="ltr">{v.vin}</strong></div></div>
    {i.checklist_generated_at ? <p className="iw-notice">{t("lockedAssignment")}</p> : null}
    {!data.technicians.length ? <p className="iw-notice">{t("noTech")}</p> : null}
    <WorkflowForm action="assign" inspectionId={i.id} button="assign" disabled={!data.can_manage || !!i.checklist_generated_at || !data.technicians.length} onSaved={onSaved}>
      <Field label="technician" name="technician_id" required value={i.technician_id}><option value="">{t("choose")}</option>{data.technicians.map(tech => <option key={tech.id} value={tech.id}>{tech.name}</option>)}</Field>
      <Field label="mileage" name="odometer_km" type="number" min={0} max={2147483647} required value={value("odometer_km", v.odometer_km?.toString())} />
      <Field label="complaint" name="complaint" type="textarea" wide required value={value("complaint", v.complaint)} />
      <Field label="market" name="market" value={value("market", v.model?.market ?? "")} />
      <Field label="lastKm" name="last_service_km" type="number" min={0} value={value("last_service_km")} />
      <Field label="lastDate" name="last_service_date" type="date" value={value("last_service_date")} />
      <p className="iw-help form-span-2">{t("baselineHelp")}</p>
      <GroupInputs selected={Array.isArray(a.groups) ? a.groups : suggestedProblemGroups(v.complaint ?? "")} />
      <fieldset className="iw-groups form-span-2"><legend>{t("capabilities")}</legend>{(["ac", "dc", "hv", "soh"] as const).map(cap => <label key={cap}><input type="checkbox" name="capabilities" value={cap} defaultChecked={Array.isArray(a.capabilities) && a.capabilities.includes(cap)} /><span>{t(cap)}</span></label>)}</fieldset>
      <p className="iw-help form-span-2">{t("capabilityHelp")}</p>
    </WorkflowForm>
  </section>;
}
function Selection({ data, onSaved }: { data: InspectionWorkspace; onSaved: () => void }) {
  const { locale, t } = useText(); const [selected, setSelected] = useState<string[]>([]); const [category, setCategory] = useState(""); const [search, setSearch] = useState("");
  const existing = new Set(data.tasks.map(task => task.definition_id));
  const checks = data.catalog.filter(check => !existing.has(check.id));
  const filtered = checks.filter(check => (!category || check.rules.groups?.includes(category)) && `${check.label_en} ${check.label_ar} ${check.code}`.toLowerCase().includes(search.toLowerCase()));
  const selectedIds = selected.filter(id => checks.some(check => check.id === id && check.eligible));
  return <section className="iw-section"><p className="iw-help">{t("pendingHelp")}</p>
    <div className="iw-toolbar"><button className="button" onClick={() => setSelected(recommendedIds(checks))}>{t("recommended")}</button><button className="button" onClick={() => setSelected([])}>{t("clear")}</button><span>{t("selected")}: <b dir="ltr">{selectedIds.length}</b></span></div>
    <div className="iw-toolbar"><input aria-label={t("search")} placeholder={t("search")} value={search} onChange={e => setSearch(e.target.value)} /><select aria-label={t("problem")} value={category} onChange={e => setCategory(e.target.value)}><option value="">{t("allCategories")}</option>{problemGroups.map(group => <option key={group} value={group}>{t(group)}</option>)}</select><button className="button" disabled={!category} onClick={() => setSelected([...new Set([...selected, ...filtered.filter(c => c.eligible).map(c => c.id)])])}>{t("selectCategory")}</button></div>
    <WorkflowForm action="generate" inspectionId={data.inspection!.id} button="generate" disabled={!data.can_manage || !selectedIds.length || !Object.keys(data.inspection!.assignment).length || data.inspection!.status !== "in_progress"} onSaved={() => { setSelected([]); onSaved(); }}>
      {selectedIds.map(id => <input type="hidden" name="ids" value={id} key={id} />)}
    </WorkflowForm>
    <div className="iw-check-grid">{filtered.map(check => <label className={`iw-check${selectedIds.includes(check.id) ? " selected" : ""}${check.eligible ? "" : " unavailable"}`} key={check.id}>
      <input type="checkbox" checked={selectedIds.includes(check.id)} disabled={!check.eligible || !data.can_manage || data.inspection!.status !== "in_progress"} onChange={e => setSelected(current => e.target.checked ? [...current, check.id] : current.filter(id => id !== check.id))} />
      <span><strong>{locale === "ar" ? check.label_ar : check.label_en}</strong><small>{t(check.reason === "complaint" ? "complaintReason" : (check.reason ?? "optional") as Key)}{check.reason === "complaint" ? `: ${(check.rules.groups ?? []).filter(group => (data.inspection!.assignment.groups as string[] | undefined)?.includes(group)).map(group => t(group as Key)).join("، ")}` : ""}</small>{check.rules.procedure_ref ? <small>{check.rules.procedure_ref}</small> : null}{!check.eligible ? <em>{t("unavailable")}</em> : null}</span>
    </label>)}</div>{!filtered.length ? <p className="iw-notice">{t("noChecks")}</p> : null}
  </section>;
}
function ResultForm({ task, data }: { task: CheckTask; data: InspectionWorkspace }) {
  const { t } = useText(); const latest = latestResult(task); const [result, setResult] = useState(""); const id = useId(); const rules = task.snapshot.rules;
  return <WorkflowForm action="record" inspectionId={data.inspection!.id} button={latest ? "retest" : "save"} disabled={!data.can_record}>
    <input type="hidden" name="task_id" value={task.id} /><input type="hidden" name="expected_attempt" value={latest?.attempt ?? 0} />
    <div className="form-field form-span-2"><label htmlFor={id}>{t("result")}</label><select id={id} name="result" value={result} required onChange={e => setResult(e.target.value)}><option value="">{t("choose")}</option>{(["pass", "fail", "inconclusive", "not_applicable"] as const).map(key => <option key={key} value={key}>{t(key)}</option>)}</select></div>
    {result === "inconclusive" || result === "not_applicable" ? <Field name="reason" label="reason" type="textarea" wide required /> : null}
    <Field name="finding" label="finding" type="textarea" wide required={result === "fail"} />
    <Field name="measurement" label="measurement" required={!!rules.evidence_required && ["pass", "fail"].includes(result)} />
    <Field name="unit" label="unit" value={rules.unit} required={!!rules.evidence_required && ["pass", "fail"].includes(result)} />
    <Field name="criteria" label="criteria" value={rules.criteria} required={["pass", "fail"].includes(result)} wide />
    <Field name="evidence" label="evidence" wide />
    <Field name="recommendation" label="recommendation" required={result === "fail"}><option value="">{t("choose")}</option>{(["none", "monitor", "service", "repair", "replace", "diagnose"] as const).filter(key => result !== "fail" || key !== "none").map(key => <option key={key} value={key}>{t(key)}</option>)}</Field>
    <Field name="urgency" label="urgency" required={result === "fail"}><option value="">{t("choose")}</option>{(["immediate", "soon", "routine"] as const).map(key => <option key={key} value={key}>{t(key)}</option>)}</Field>
    {latest ? <Field name="retest_note" label="retestNote" type="textarea" wide required /> : null}
  </WorkflowForm>;
}
function TaskCard({ task, data, review }: { task: CheckTask; data: InspectionWorkspace; review?: boolean }) {
  const { locale, t } = useText(); const latest = latestResult(task); const [editing, setEditing] = useState(false);
  const current = latest?.result ?? "pending";
  return <article className={`iw-task iw-result-${current}`}>
    <div className="iw-task-heading"><span className="iw-task-number" dir="ltr">{task.sequence}</span><h3>{locale === "ar" ? task.snapshot.label_ar : task.snapshot.label_en}</h3><span className={`iw-result ${current}`}>{t(current)}</span></div>
    {latest ? <div className="iw-task-summary">{latest.details.finding ? <p>{latest.details.finding}</p> : null}{latest.details.reason ? <p>{latest.details.reason}</p> : null}{latest.details.recommendation ? <span>{t("recommendation")}: {t(latest.details.recommendation as Key)}</span> : null}{latest.details.urgency ? <span>{t("urgency")}: {t(latest.details.urgency as Key)}</span> : null}</div> : null}
    {task.snapshot.rules.procedure_ref ? <p className="iw-help">{t("procedure")}: {task.snapshot.rules.procedure_ref}</p> : null}
    {task.attempts.length ? <details className="iw-history"><summary>{t("history")} <span dir="ltr">({task.attempts.length})</span></summary><p>{t("immutable")}</p>{task.attempts.map(attempt => <div className="iw-attempt" key={attempt.id}><strong>{t("attempt")} <bdi>{attempt.attempt}</bdi> · {t(attempt.result)}</strong><small>{attempt.actor_name} · <time dir="ltr">{new Intl.DateTimeFormat(locale === "ar" ? "ar-JO-u-nu-latn" : "en-JO", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Amman" }).format(new Date(attempt.recorded_at))}</time></small><dl>{(["finding", "measurement", "unit", "criteria", "evidence", "reason", "retest_note"] as const).filter(key => attempt.details[key]).map(key => <div key={key}><dt>{t(key === "retest_note" ? "retestNote" : key)}</dt><dd dir={key === "measurement" || key === "unit" ? "ltr" : undefined}>{attempt.details[key]}</dd></div>)}</dl></div>)}</details> : null}
    {!review && data.can_record && ["in_progress", "completed"].includes(data.inspection!.status) ? <><button className="button" onClick={() => setEditing(value => !value)} aria-expanded={editing}>{t(latest ? "retest" : "record")}</button>{editing ? <ResultForm key={latest?.id ?? "initial"} task={task} data={data} /> : null}</> : null}
    {review && data.can_review && (!latest || latest.result === "inconclusive") ? <details className="iw-history"><summary>{t("exception")}</summary><p>{t("exceptionHelp")}</p><WorkflowForm action="exception" inspectionId={data.inspection!.id} button="approve"><input type="hidden" name="task_id" value={task.id} /><input type="hidden" name="expected_attempt" value={latest?.attempt ?? 0} /><Field name="reason" label="reason" type="textarea" wide required /></WorkflowForm></details> : null}
  </article>;
}
function Workflow({ data }: { data: InspectionWorkspace }) {
  const { t } = useText(); const i = data.inspection!; const progress = checklistProgress(data.tasks);
  const [step, setStep] = useState<Key>(i.status === "completed" ? "review" : i.checklist_generated_at ? "record" : Object.keys(i.assignment).length ? "select" : "assign");
  const unreviewed = i.completed_at && data.tasks.some(task => task.attempts.some(a => new Date(a.recorded_at) > new Date(i.completed_at!)));
  return <div className="iw-workflow">
    <nav className="iw-steps" aria-label={t("catalog")}>{(["assign", "select", "record", "review"] as const).map((key, index) => <button key={key} type="button" aria-current={step === key ? "step" : undefined} onClick={() => setStep(key)}><span dir="ltr">{index + 1}</span>{t(key)}</button>)}</nav>
    {data.tasks.length ? <div className="iw-progress"><strong>{t("completed")}: <bdi>{progress.completed} / {progress.total}</bdi></strong><progress aria-label={t("completed")} max={progress.total} value={progress.completed} /><span>{t("outstanding")}: <bdi>{progress.outstanding.length}</bdi></span></div> : null}
    {step === "assign" ? <Assignment key={i.checklist_generated_at ?? "draft"} data={data} onSaved={() => setStep("select")} /> : null}
    {step === "select" ? <Selection data={data} onSaved={() => setStep("record")} /> : null}
    {(step === "record" || step === "review") && !data.tasks.length ? <p className="iw-notice">{t("noTasks")}</p> : null}
    {step === "record" ? <section className="iw-section">{!data.can_record ? <p className="iw-notice">{t("onlyTech")}</p> : null}{data.tasks.map(task => <TaskCard key={task.id} task={task} data={data} />)}</section> : null}
    {step === "review" && data.tasks.length ? <section className="iw-section"><p className="iw-help">{t("reviewHelp")}</p>{unreviewed ? <p className="iw-notice">{t("retestReview")}</p> : null}{data.tasks.filter(task => latestResult(task)?.result !== "pass").map(task => <TaskCard key={task.id} task={task} data={data} review />)}{!data.can_review ? <p className="iw-notice">{t("onlyAdmin")}</p> : <WorkflowForm action="review" inspectionId={i.id} button="complete" disabled={progress.outstanding.length > 0 || (i.status === "completed" && !unreviewed)}><Field name="review_note" label="reviewNote" value={i.review_note} type="textarea" wide required /></WorkflowForm>}</section> : null}
  </div>;
}
function Catalog({ checks, models }: { checks: CheckDefinition[]; models: VehicleModelOption[] }) {
  const { locale, t } = useText(); const [selected, setSelected] = useState<CheckDefinition | null>(null); const [search, setSearch] = useState(""); const [version, setVersion] = useState(0); const rule = selected?.rules;
  return <section className="panel operation-form" id="check-catalog"><div className="panel-header"><div><div className="panel-title">{t("catalog")}</div><div className="panel-subtitle">{t("catalogHelp")}</div></div><button className="button" onClick={() => { setSelected(null); setVersion(v => v + 1); }}>{t("newCheck")}</button></div><div className="iw-catalog-layout">
    <aside className="iw-catalog-items"><input aria-label={t("search")} placeholder={t("search")} value={search} onChange={e => setSearch(e.target.value)} />{checks.filter(c => `${c.code} ${c.label_en} ${c.label_ar}`.toLowerCase().includes(search.toLowerCase())).map(check => <button className={selected?.id === check.id ? "selected" : ""} key={check.id} onClick={() => { setSelected(check); setVersion(v => v + 1); }}><strong>{locale === "ar" ? check.label_ar : check.label_en}</strong><small dir="ltr">{check.code}</small><small>{models.find(m => m.id === check.vehicle_model_id)?.name ?? t("allModels")}</small></button>)}</aside>
    <div className="iw-section"><h3>{t(selected ? "edit" : "newCheck")}</h3><p className="iw-help">{t("specialistHelp")}</p><WorkflowForm key={version} action="configure">
      <input type="hidden" name="id" value={selected?.id ?? ""} />
      <Field name="code" label="code" value={selected?.code} required /><Field name="category" label="category" value={selected?.category ?? "identity"}>{checkCategories.map(c => <option key={c} value={c}>{t(c)}</option>)}</Field>
      <Field name="label_en" label="english" value={selected?.label_en} required /><Field name="label_ar" label="arabic" value={selected?.label_ar} required />
      <Field name="vehicle_model_id" label="model" value={selected?.vehicle_model_id}><option value="">{t("allModels")}</option>{models.map(m => <option key={m.id} value={m.id}>{m.name} · {m.model_code} · {m.market}</option>)}</Field>
      <Field name="rule.market" label="market" value={rule?.market} /><Field name="rule.year_from" label="yearFrom" type="number" min={1900} max={2200} value={rule?.year_from} /><Field name="rule.year_to" label="yearTo" type="number" min={1900} max={2200} value={rule?.year_to} />
      <GroupInputs prefix="rule." selected={rule?.groups} />
      <label className="check-field"><input name="rule.baseline" type="checkbox" defaultChecked={rule?.baseline} />{t("baselineCheck")}</label><label className="check-field"><input name="is_required" type="checkbox" defaultChecked={selected?.is_required} />{t("requiredCheck")}</label>
      <Field name="rule.capability" label="capability" value={rule?.capability}><option value="">{t("noCapability")}</option>{(["ac", "dc", "hv", "soh"] as const).map(c => <option key={c} value={c}>{t(c)}</option>)}</Field>
      <Field name="rule.qualification" label="qualification" value={rule?.qualification} /><Field name="rule.procedure_ref" label="procedure" value={rule?.procedure_ref} wide />
      <Field name="rule.criteria" label="criteria" value={rule?.criteria} wide /><Field name="rule.unit" label="unit" value={rule?.unit} /><label className="check-field"><input name="rule.evidence_required" type="checkbox" defaultChecked={rule?.evidence_required} />{t("measured")}</label>
      <Field name="rule.interval_km" label="intervalKm" type="number" min={1} value={rule?.interval_km} /><Field name="rule.interval_months" label="intervalMonths" type="number" min={1} value={rule?.interval_months} /><Field name="rule.manufacturer_ref" label="source" value={rule?.manufacturer_ref} wide />
    </WorkflowForm></div>
  </div></section>;
}

export function InspectionWorkflow({ data, saveAction }: { data: InspectionWorkspace; saveAction: SaveInspectionAction }) {
  return <InspectionSaveContext.Provider value={saveAction}><Workflow data={data} /></InspectionSaveContext.Provider>;
}
export function InspectionCatalog({ checks, models, saveAction }: { checks: CheckDefinition[]; models: VehicleModelOption[]; saveAction: SaveInspectionAction }) {
  return <InspectionSaveContext.Provider value={saveAction}><Catalog checks={checks} models={models} /></InspectionSaveContext.Provider>;
}
