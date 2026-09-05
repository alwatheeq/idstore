import { CheckCircle2, CircleAlert } from "lucide-react";
import { LocalizedText } from "@/components/localized-text";

export function RecordFeedback({ created, error }: { created?: string; error?: string }) {
  if (!created && !error) return null;
  return (
    <div className={`record-feedback ${error ? "error" : "success"}`} role={error ? "alert" : "status"} aria-live={error ? "assertive" : "polite"}>
      {error ? <CircleAlert /> : <CheckCircle2 />}
      <span><LocalizedText>{error ?? created ?? ""}</LocalizedText></span>
    </div>
  );
}
