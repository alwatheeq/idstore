"use client";

import { useUiLocale } from "@/components/ui-locale";

type StatusPillProps = {
  label: string;
  tone?: "blue" | "green" | "amber" | "red" | "gray";
};

export function StatusPill({ label, tone = "gray" }: StatusPillProps) {
  const { statusText } = useUiLocale();
  return <span className={`status-pill ${tone}`}>{statusText(label)}</span>;
}
