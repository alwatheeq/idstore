import Link from "next/link";
import { LocalizedText } from "@/components/localized-text";
import { RecordAction } from "@/components/record-action";

export function RecordRemovalForm({ action, fields, title, name, description, back }: {
  action: (form: FormData) => Promise<void>; fields: Record<string, string>; title: string; name: string; description: string; back: string;
}) {
  return <section className="panel operation-form directory-editor" id="confirm-record-action"><div className="panel-header"><div><h2 className="panel-title"><LocalizedText>{title}</LocalizedText></h2><p className="panel-subtitle"><bdi>{name}</bdi></p></div><RecordAction kind="close" href={back} /></div>
    <form action={action} className="form-grid panel-body">{Object.entries(fields).map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}
      <p className="form-span-2"><LocalizedText>{description}</LocalizedText></p>
      <div className="form-field form-span-2"><label htmlFor="removal-reason"><LocalizedText>Reason</LocalizedText></label><textarea id="removal-reason" name="reason" rows={2} minLength={3} maxLength={500} required /></div>
      <label className="checkbox-field form-span-2"><input type="checkbox" name="confirmed" required /><LocalizedText>Confirm this record action before continuing.</LocalizedText></label>
      <div className="form-actions form-span-2"><Link className="button" href={back}><LocalizedText>Back</LocalizedText></Link><button className="button primary" type="submit"><LocalizedText>{title}</LocalizedText></button></div>
    </form>
  </section>;
}
