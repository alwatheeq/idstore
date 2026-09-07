import type { ReactNode } from "react";

/** One visible label and one control, including repeated inline/table forms. */
export function LabeledControl({ label, children }: { label: ReactNode; children: ReactNode }) {
  return <label className="form-field labeled-control"><span className="field-label">{label}</span>{children}</label>;
}
