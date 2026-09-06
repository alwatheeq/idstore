"use client";

import { useUiLocale } from "@/components/ui-locale";

const issuesPrefix = "Reported issues: ";
const notesPrefix = "Customer notes: ";

export function CustomerConcernText({ value }: { value: string | null }) {
  const { pageText } = useUiLocale();

  if (!value) return <>{pageText("No customer concern recorded")}</>;

  const lines = value.split("\n");
  const issuesLine = lines.find((line) => line.startsWith(issuesPrefix));
  const notesLine = lines.find((line) => line.startsWith(notesPrefix));
  if (!issuesLine && !notesLine) return <>{value}</>;

  const issues = issuesLine?.slice(issuesPrefix.length).split("; ").filter(Boolean) ?? [];
  const notes = notesLine?.slice(notesPrefix.length);

  return <>
    {issues.length ? <span className="customer-concern-line"><strong>{pageText("Reported issues")}:</strong> {issues.map(pageText).join(" · ")}</span> : null}
    {notes ? <span className="customer-concern-line"><strong>{pageText("Customer notes")}:</strong> {notes}</span> : null}
  </>;
}

