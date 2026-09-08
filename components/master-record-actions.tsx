import { RecordAction } from "@/components/record-action";
import { recordManagementHref } from "@/lib/record-management";

export function MasterRecordActions({ kind, id, archived = false, editHref }: { kind: string; id: string; archived?: boolean; editHref?: string }) {
  return <span className="record-actions">
    {!archived ? <RecordAction kind="edit" href={editHref ?? recordManagementHref(kind, id)} /> : null}
    <RecordAction kind={archived ? "restore" : "archive"} href={recordManagementHref(kind, id, archived ? "restore" : "archive")} />
  </span>;
}
