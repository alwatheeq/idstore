import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useInvoices } from "@/features/invoices/hooks";
import { InvoiceStatusBadge } from "@/features/invoices/InvoiceStatusBadge";
import { Select } from "@/components/ui/Select";
import { PageHeader } from "@/components/ui/PageHeader";
import type { PaymentStatus } from "@/lib/money";

export function InvoicesPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<PaymentStatus | "">("");
  const { data: invoices, isLoading } = useInvoices(status || undefined);

  const statusOptions = [
    { value: "", label: t("invoices.allStatuses") },
    ...(["unpaid", "partial", "paid"] as const).map((s) => ({ value: s, label: t(`paymentStatus.${s}`) })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("invoices.title")} eyebrow={t("nav.invoices")} />

      <div className="max-w-xs">
        <Select label={t("invoices.filterByStatus")} options={statusOptions} value={status}
          onChange={(e) => setStatus(e.target.value as PaymentStatus | "")} />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted">{t("common.loading")}</p>
      ) : !invoices || invoices.length === 0 ? (
        <div className="card grid place-items-center p-12 text-sm text-muted">
          {t("invoices.empty")}
        </div>
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {invoices.map((inv) => (
            <li key={inv.id}>
              <Link
                to={`/invoices/${inv.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-paper-2"
              >
                <span className="font-medium text-ink">
                  <span className="num">#{inv.invoice_number}</span> · {t("invoices.forOrder")}{" "}
                  <span className="num">#{inv.service_orders?.order_number ?? "—"}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-sm text-muted">{inv.service_orders?.customers?.name ?? ""}</span>
                  <span className="num text-sm text-ink">{inv.total.toFixed(3)} JOD</span>
                  <InvoiceStatusBadge status={inv.payment_status} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
