import { useTranslation } from "react-i18next";
import { statusLabel } from "./status";
import type { OrderStatus } from "./types";

const colors: Record<OrderStatus, string> = {
  appointment: "bg-info-soft text-info",
  intake: "bg-info-soft text-info",
  diagnosis: "bg-info-soft text-info",
  estimate: "bg-info-soft text-info",
  awaiting_approval: "bg-warn-soft text-warn",
  in_progress: "bg-volt-soft text-volt-deep",
  qc: "bg-warn-soft text-warn",
  ready: "bg-ok-soft text-ok",
  closed: "bg-ok-soft text-ok",
  cancelled: "bg-paper-2 text-muted",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useTranslation();
  return (
    <span className={`badge ${colors[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {statusLabel(t, status)}
    </span>
  );
}
