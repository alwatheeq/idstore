import { LocalizedContent } from "@/components/localized-content";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { recordDefinition } from "@/lib/record-management";
import { RecordFeedback } from "@/components/record-feedback";
import { RecordAction } from "@/components/record-action";
import { LocalizedText } from "@/components/localized-text";
import { manageRecord } from "./actions";

export default async function ManageRecordPage({ searchParams }: { searchParams: Promise<{ kind?: string; id?: string; action?: string; error?: string }> }) {
  const query = await searchParams;
  const staff = await getCurrentStaff();
  const definition = recordDefinition(query.kind ?? "");
  const mode = query.action ?? "edit";
  if (staff.role !== "admin" || !definition || !["edit", "archive", "restore"].includes(mode)) notFound();
  const supabase = await createClient();
  if (!query.id) {
    const archivedQuery = supabase.from(definition.table).select("*").eq("organization_id", staff.organizationId);
    const { data: archived, error: archiveError } = definition.table === "inspection_check_definitions"
      ? await archivedQuery.filter("active", "eq", false).order("updated_at", { ascending: false }).limit(200)
      : await archivedQuery.filter("status", "eq", definition.table === "resources" ? "inactive" : "archived").order("updated_at", { ascending: false }).limit(200);
    return <LocalizedContent>{<section className="panel"><div className="panel-header"><h1 className="panel-title"><LocalizedText>Archived records</LocalizedText> · <LocalizedText>{definition.title}</LocalizedText></h1><RecordAction kind="close" href={definition.back} /></div><div className="panel-body"><RecordFeedback error={archiveError ? "The record could not be loaded. Try again." : undefined} />{!archived?.length && !archiveError ? <p><LocalizedText>No archived records.</LocalizedText></p> : null}{archived?.map(item => <div key={item.id} className="archived-record-row"><bdi>{String((item as Record<string, unknown>)[definition.name] ?? item.id)}</bdi><RecordAction kind="restore" href={`/records/manage?kind=${query.kind}&id=${item.id}&action=restore`} /></div>)}{archived?.length === 200 ? <p><LocalizedText>Showing the latest 200 archived records.</LocalizedText></p> : null}</div></section>}</LocalizedContent>;
  }
  if (!/^[0-9a-f-]{36}$/i.test(query.id)) notFound();
  const { data, error } = await supabase.from(definition.table).select("*").eq("id", query.id).eq("organization_id", staff.organizationId).maybeSingle();
  if (error) return <LocalizedContent>{<RecordFeedback error="The record could not be loaded. Try again." />}</LocalizedContent>;
  if (!data) notFound();
  const record = data as Record<string, unknown>;
  const archived = record.status === "archived" || (query.kind === "resource" && record.status === "inactive") || record.active === false;
  if ((mode === "edit" && (!definition.fields.length || archived)) || (mode === "restore" && !archived)) notFound();
  const title = mode === "edit" ? "Edit" : mode === "archive" ? "Archive" : "Restore";
  return <LocalizedContent>{<section className="panel operation-form directory-editor">
    <div className="panel-header"><div><h1 className="panel-title"><LocalizedText>{title}</LocalizedText> · <LocalizedText>{definition.title}</LocalizedText></h1><p className="panel-subtitle"><bdi>{String(record[definition.name] ?? query.id)}</bdi></p></div><RecordAction kind="close" href={definition.back} /></div>
    <RecordFeedback error={query.error} />
    <form action={manageRecord} className="form-grid panel-body">
      <input type="hidden" name="kind" value={query.kind} /><input type="hidden" name="id" value={query.id} /><input type="hidden" name="mode" value={mode} /><input type="hidden" name="updatedAt" value={String(record.updated_at)} />
      {mode === "edit" ? definition.fields.map(field => <div className={`form-field ${field.type === "textarea" ? "form-span-2" : ""}`} key={field.name}>
        <label htmlFor={`record-${field.name}`}><LocalizedText>{field.label}</LocalizedText></label>
        {field.options ? <select id={`record-${field.name}`} name={field.name} defaultValue={String(record[field.name] ?? "")} required={field.required}>{field.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
          : field.type === "textarea" ? <textarea id={`record-${field.name}`} name={field.name} rows={3} maxLength={field.maxLength ?? 240} defaultValue={String(record[field.name] ?? "")} />
          : <input id={`record-${field.name}`} name={field.name} type={field.type ?? "text"} min={field.type === "number" ? 0 : undefined} step={field.type === "number" ? "0.001" : undefined} dir={["number", "tel", "email"].includes(field.type ?? "") ? "ltr" : undefined} maxLength={field.maxLength ?? 240} required={field.required} defaultValue={String(record[field.name] ?? "")} />}
      </div>) : <>
        <p className="form-span-2"><LocalizedText>{mode === "archive" ? "Archive removes this record from active use. Linked orders, invoices and history are retained." : "Restore makes this record available again. Customer portal access must be enabled separately."}</LocalizedText></p>
        <div className="form-field form-span-2"><label htmlFor="record-reason"><LocalizedText>Reason</LocalizedText></label><textarea id="record-reason" name="reason" rows={2} minLength={3} maxLength={500} required /></div>
        <label className="checkbox-field form-span-2"><input type="checkbox" name="confirmed" required /><LocalizedText>Confirm this record action before continuing.</LocalizedText></label>
      </>}
      <div className="form-actions form-span-2"><Link href={definition.back} className="button"><LocalizedText>Cancel</LocalizedText></Link><button type="submit" className="button primary"><LocalizedText>{mode === "edit" ? "Save" : title}</LocalizedText></button></div>
    </form>
  </section>}</LocalizedContent>;
}
