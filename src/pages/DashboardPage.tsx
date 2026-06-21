import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useOrders } from "@/features/orders/hooks";
import { useInvoices } from "@/features/invoices/hooks";
import { statusLabel } from "@/features/orders/status";
import { computeDashboard } from "@/features/dashboard/stats";
import { KpiCard } from "@/features/dashboard/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";

export function DashboardPage() {
  const { t } = useTranslation();
  const { data: orders, isLoading } = useOrders();
  const { data: invoices } = useInvoices();
  const stats = computeDashboard(orders ?? [], invoices ?? [], new Date());

  return (
    <div className="space-y-8">
      <PageHeader title={t("dashboard.title")} eyebrow={t("app.subtitle")} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label={t("dashboard.carsInWorkshop")} value={stats.carsInWorkshop} />
        <KpiCard label={t("dashboard.awaitingApproval")} value={stats.awaitingApproval} />
        <KpiCard label={t("dashboard.readyForHandover")} value={stats.readyForHandover} />
        <KpiCard
          label={t("dashboard.invoicedToday")}
          value={`${stats.invoicedToday.toFixed(3)} JOD`}
          accent
        />
      </div>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold tracking-tight text-ink">{t("dashboard.byStage")}</h3>
        {isLoading ? (
          <p className="text-sm text-muted">{t("common.loading")}</p>
        ) : stats.board.length === 0 ? (
          <div className="card grid place-items-center p-12 text-sm text-muted">
            {t("dashboard.empty")}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stats.board.map((col) => (
              <div key={col.status} className="card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="micro">{statusLabel(t, col.status)}</h4>
                  <span className="num rounded-full bg-paper-2 px-2 py-0.5 text-xs font-semibold text-ink-2">
                    {col.orders.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {col.orders.map((o) => (
                    <Link
                      key={o.id}
                      to={`/orders/${o.id}`}
                      className="block rounded-xl border border-line bg-paper px-3 py-2.5 text-sm transition-colors hover:border-line-strong hover:bg-paper-2"
                    >
                      <span className="font-medium text-ink">
                        <span className="num text-muted">#{o.order_number}</span>{" "}
                        {o.vehicles?.model ?? ""}{" "}
                        <span className="num">{o.vehicles?.plate_number ?? ""}</span>
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {o.customers?.name ?? ""}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
