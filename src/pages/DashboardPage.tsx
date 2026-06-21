import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useOrders } from "@/features/orders/hooks";
import { useInvoices } from "@/features/invoices/hooks";
import { statusLabel } from "@/features/orders/status";
import { computeDashboard } from "@/features/dashboard/stats";
import { KpiCard } from "@/features/dashboard/KpiCard";

export function DashboardPage() {
  const { t } = useTranslation();
  const { data: orders, isLoading } = useOrders();
  const { data: invoices } = useInvoices();
  const stats = computeDashboard(orders ?? [], invoices ?? [], new Date());

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-bold">{t("dashboard.title")}</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label={t("dashboard.carsInWorkshop")} value={stats.carsInWorkshop} />
        <KpiCard label={t("dashboard.awaitingApproval")} value={stats.awaitingApproval} />
        <KpiCard label={t("dashboard.readyForHandover")} value={stats.readyForHandover} />
        <KpiCard label={t("dashboard.invoicedToday")} value={`${stats.invoicedToday.toFixed(3)} JOD`} />
      </div>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">{t("dashboard.byStage")}</h3>
        {isLoading ? (
          <p className="opacity-70">{t("common.loading")}</p>
        ) : stats.board.length === 0 ? (
          <p className="opacity-70">{t("dashboard.empty")}</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.board.map((col) => (
              <div key={col.status} className="space-y-2">
                <h4 className="text-xs uppercase tracking-wide opacity-60">
                  {statusLabel(t, col.status)} ({col.orders.length})
                </h4>
                {col.orders.map((o) => (
                  <Link
                    key={o.id}
                    to={`/orders/${o.id}`}
                    className="block border rounded-lg px-3 py-2 hover:bg-gray-50 text-sm"
                  >
                    <span className="font-medium">
                      #{o.order_number} {o.vehicles?.model ?? ""} {o.vehicles?.plate_number ?? ""}
                    </span>
                    <span className="block opacity-60">{o.customers?.name ?? ""}</span>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
