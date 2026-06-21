import { useTranslation } from "react-i18next";
import { statusLabel } from "./status";
import type { OrderStatus } from "./types";

const colors: Record<OrderStatus, string> = {
  appointment: "bg-gray-100 text-gray-700",
  intake: "bg-blue-100 text-blue-700",
  diagnosis: "bg-blue-100 text-blue-700",
  estimate: "bg-indigo-100 text-indigo-700",
  awaiting_approval: "bg-amber-100 text-amber-700",
  in_progress: "bg-amber-100 text-amber-700",
  qc: "bg-purple-100 text-purple-700",
  ready: "bg-green-100 text-green-700",
  closed: "bg-green-100 text-green-700",
  cancelled: "bg-gray-200 text-gray-500",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useTranslation();
  return (
    <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ${colors[status]}`}>
      {statusLabel(t, status)}
    </span>
  );
}
