"use client";
import { useActionState, useEffect, useId, useState } from "react";
import Link from "next/link";
import { CalendarClock, Phone } from "lucide-react";
import { useUiLocale } from "@/components/ui-locale";
import { JourneyDate } from "@/components/journey-date";
import { followupCopy, type FollowupTextKey } from "@/lib/i18n/followups";
import { followupDueState, sortFollowups, workshopToday } from "@/lib/followups";
import { rescheduleFollowup } from "@/app/(app)/vehicles/followup-actions";

export type Followup = { id: string; vehicle_id: string; description: string; severity: string; due_date: string | null; updated_at: string; vehicleLabel: string; contacts: { id: string; name: string; phone: string | null }[] };
function useText() { const { locale } = useUiLocale(); return (key: FollowupTextKey) => followupCopy[key][locale === "ar" ? 1 : 0]; }
function DueEditor({ item }: { item: Followup }) {
  const t = useText(); const id = useId();
  const [state, action, pending] = useActionState(rescheduleFollowup, {});
  return <details className="followup-editor"><summary>{t("edit")}</summary><form action={action}>
    <input type="hidden" name="id" value={item.id} /><input type="hidden" name="updatedAt" value={item.updated_at} />
    <div className="form-field"><label htmlFor={id}>{t("date")}</label><input id={id} type="date" name="dueDate" dir="ltr" defaultValue={item.due_date ?? ""} disabled={pending} /></div>
    <button className="button compact" disabled={pending} type="submit">{t(pending ? "saving" : "save")}</button>
    {state.error ? <p role="alert">{t("saveError")}</p> : state.success ? <p role="status">{t("saved")}</p> : null}
  </form></details>;
}
export function FollowupList({ items, today: initialToday, error = false, canEdit = false }: { items: Followup[]; today: string; error?: boolean; canEdit?: boolean }) {
  const t = useText(); const [today, setToday] = useState(initialToday);
  useEffect(() => { const timer = setInterval(() => setToday(workshopToday()), 60000); return () => clearInterval(timer); }, []);
  return <section className="panel followup-panel" aria-label={t("title")}>
    <div className="panel-header"><div><div className="panel-title"><CalendarClock size={20} aria-hidden="true" /> {t("title")} <bdi>{items.length}</bdi></div><p className="panel-subtitle">{t("help")}</p></div></div>
    {error ? <p className="panel-body" role="alert">{t("error")}</p> : !items.length ? <p className="panel-body">{t("empty")}</p> : <div className="followup-items">{sortFollowups(items).map(item => {
      const state = followupDueState(item.due_date, today);
      return <article className="followup-item" key={item.id}>
        <div className="followup-content"><div className="followup-tags"><span className={`followup-due ${state}`}>{t(state)}</span><span>{t(item.severity === "safety_stop" ? "safety" : item.severity === "red" ? "high" : "stable")}</span></div>
          <strong>{item.description}</strong><Link href={`/vehicles?manage=${item.vehicle_id}#vehicle-controls`}><bdi>{item.vehicleLabel}</bdi></Link>
          <div className="followup-contacts">{item.contacts.map(contact => <div key={contact.id}><Link href={`/customers?manage=${contact.id}#customer-controls`}>{contact.name}</Link>{contact.phone && /^\+?[0-9]{6,15}$/.test(contact.phone) ? <a href={`tel:${contact.phone}`} aria-label={`${t("call")}: ${contact.name}`}><Phone size={16} aria-hidden="true" /><bdi dir="ltr">{contact.phone}</bdi></a> : <small>{t("noPhone")}</small>}</div>)}</div>
        </div><div className="followup-date"><span>{t("date")}</span>{item.due_date ? <JourneyDate value={item.due_date} /> : <span>—</span>}{canEdit ? <DueEditor key={item.updated_at} item={item} /> : null}</div>
      </article>;
    })}</div>}
  </section>;
}
