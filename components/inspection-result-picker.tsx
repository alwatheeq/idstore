"use client";

import { CircleCheck, CircleHelp, CircleMinus, CircleX } from "lucide-react";
import { useUiLocale } from "@/components/ui-locale";
import { inspectionText } from "@/lib/i18n/inspection";

const choices = [
  { value: "pass", Icon: CircleCheck },
  { value: "fail", Icon: CircleX },
  { value: "inconclusive", Icon: CircleHelp },
  { value: "not_applicable", Icon: CircleMinus },
] as const;

export function InspectionResultPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { locale } = useUiLocale();
  return <fieldset className="iw-result-picker form-span-2">
    <legend>{inspectionText("result", locale)}</legend>
    <div className="iw-result-options">
      {choices.map(({ value: option, Icon }) => <label key={option} className={`iw-result-choice iw-choice-${option}`}>
        <input type="radio" name="result" value={option} checked={value === option} onChange={() => onChange(option)} required />
        <span className="iw-result-choice-face">
          <Icon className="iw-choice-icon" size={28} strokeWidth={2} aria-hidden="true" />
          <span>{inspectionText(option, locale)}</span>
          <span className="iw-choice-indicator" aria-hidden="true" />
        </span>
      </label>)}
    </div>
  </fieldset>;
}
