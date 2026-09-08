"use client";

import Link from "next/link";
import { Archive, Eye, Pencil, RotateCcw, Trash2, X } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { useUiLocale } from "@/components/ui-locale";

export type RecordActionKind = "edit" | "view" | "archive" | "restore" | "delete" | "close";
const icons = { edit: Pencil, view: Eye, archive: Archive, restore: RotateCcw, delete: Trash2, close: X };
const labels = { edit: "Edit", view: "Details", archive: "Archive", restore: "Restore", delete: "Delete", close: "Close" };
type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  kind: RecordActionKind;
  label?: string;
  href?: string;
  confirmation?: string;
};

/** A real link or submit button: keyboard accessible, localized, no hidden menu. */
export function RecordAction({ kind, label, href, confirmation, className = "", onClick, ...props }: Props) {
  const { pageText: t } = useUiLocale();
  const title = t(label ?? labels[kind]);
  const Icon = icons[kind];
  const classes = `record-action ${kind === "delete" || kind === "archive" ? "record-action-danger" : ""} ${className}`;
  if (href) return <Link className={classes} href={href} title={title} aria-label={title}><Icon aria-hidden="true" /></Link>;
  return <button {...props} className={classes} type={props.type ?? "submit"} title={title} aria-label={title} onClick={event => {
    if (confirmation && !window.confirm(t(confirmation))) { event.preventDefault(); return; }
    onClick?.(event);
  }}><Icon aria-hidden="true" /></button>;
}
