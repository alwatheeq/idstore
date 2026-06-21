import type { OrderStatus } from "./types";

const PIPELINE: OrderStatus[] = [
  "appointment", "intake", "diagnosis", "estimate", "awaiting_approval",
  "in_progress", "qc", "ready", "closed",
];
export const ORDER_STATUSES: OrderStatus[] = [...PIPELINE, "cancelled"];

export function nextStatus(s: OrderStatus): OrderStatus | null {
  const i = PIPELINE.indexOf(s);
  if (i === -1 || i >= PIPELINE.length - 1) return null;
  return PIPELINE[i + 1];
}
export function canAdvance(s: OrderStatus): boolean { return nextStatus(s) !== null; }
export function statusLabel(t: (key: string) => string, s: OrderStatus): string {
  return t(`status.${s}`);
}
