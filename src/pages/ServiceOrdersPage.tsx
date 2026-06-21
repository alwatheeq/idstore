import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useOrders } from "@/features/orders/hooks";
import { ORDER_STATUSES } from "@/features/orders/status";
import { OrderStatusBadge } from "@/features/orders/OrderStatusBadge";
import { buttonClasses } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import type { OrderStatus } from "@/features/orders/types";

export function ServiceOrdersPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<OrderStatus | "">("");
  const { data: orders, isLoading } = useOrders(status || undefined);

  const statusOptions = [
    { value: "", label: t("orders.allStatuses") },
    ...ORDER_STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold">{t("orders.title")}</h2>
        <Link to="/orders/new" className={buttonClasses()}>{t("orders.newOrder")}</Link>
      </div>

      <div className="max-w-xs">
        <Select
          label={t("orders.allStatuses")}
          options={statusOptions}
          value={status}
          onChange={(e) => setStatus(e.target.value as OrderStatus | "")}
        />
      </div>

      {isLoading ? (
        <p className="opacity-70">{t("common.loading")}</p>
      ) : !orders || orders.length === 0 ? (
        <p className="opacity-70">{t("orders.empty")}</p>
      ) : (
        <ul className="divide-y border rounded-lg">
          {orders.map((o) => (
            <li key={o.id}>
              <Link to={`/orders/${o.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-gray-50">
                <span className="font-medium">
                  #{o.order_number} · {o.vehicles?.model ?? ""} {o.vehicles?.plate_number ?? ""}
                </span>
                <span className="flex items-center gap-3">
                  <span className="opacity-60 text-sm">{o.customers?.name ?? ""}</span>
                  <OrderStatusBadge status={o.status} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
