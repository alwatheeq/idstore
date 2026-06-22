import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useOrders } from "@/features/orders/hooks";
import { ORDER_STATUSES } from "@/features/orders/status";
import { OrderStatusBadge } from "@/features/orders/OrderStatusBadge";
import { buttonClasses } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { PageHeader } from "@/components/ui/PageHeader";
import { useActiveBranch } from "@/features/branches/ActiveBranchContext";
import type { OrderStatus } from "@/features/orders/types";

export function ServiceOrdersPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<OrderStatus | "">("");
  const { data: orders, isLoading } = useOrders(status || undefined);
  const { isAll } = useActiveBranch();

  const statusOptions = [
    { value: "", label: t("orders.allStatuses") },
    ...ORDER_STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("orders.title")}
        eyebrow={t("nav.orders")}
        actions={
          isAll ? (
            <span className="text-xs font-medium text-muted">{t("branch.pickToCreate")}</span>
          ) : (
            <Link to="/orders/new" className={buttonClasses()}>
              {t("orders.newOrder")}
            </Link>
          )
        }
      />

      <div className="max-w-xs">
        <Select
          label={t("orders.filterByStatus")}
          options={statusOptions}
          value={status}
          onChange={(e) => setStatus(e.target.value as OrderStatus | "")}
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted">{t("common.loading")}</p>
      ) : !orders || orders.length === 0 ? (
        <div className="card grid place-items-center p-12 text-sm text-muted">
          {t("orders.empty")}
        </div>
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {orders.map((o) => {
            const veh = [o.vehicles?.model, o.vehicles?.plate_number].filter(Boolean).join(" ");
            return (
              <li key={o.id}>
                <Link
                  to={`/orders/${o.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-paper-2"
                >
                  <span className="font-medium text-ink">
                    <span className="num text-muted">#{o.order_number}</span>
                    {veh ? ` · ${veh}` : ""}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-sm text-muted">{o.customers?.name ?? ""}</span>
                    <OrderStatusBadge status={o.status} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
