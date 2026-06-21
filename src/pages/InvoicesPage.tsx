import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useInvoices } from "@/features/invoices/hooks";
import { InvoiceStatusBadge } from "@/features/invoices/InvoiceStatusBadge";
import { Select } from "@/components/ui/Select";
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
      <h2 className="text-xl font-bold">{t("invoices.title")}</h2>

      <div className="max-w-xs">
        <Select label={t("invoices.filterByStatus")} options={statusOptions} value={status}
          onChange={(e) => setStatus(e.target.value as PaymentStatus | "")} />
      </div>

      {isLoading ? (
        <p className="opacity-70">{t("common.loading")}</p>
      ) : !invoices || invoices.length === 0 ? (
        <p className="opacity-70">{t("invoices.empty")}</p>
      ) : (
        <ul className="divide-y border rounded-lg">
          {invoices.map((inv) => (
            <li key={inv.id}>
              <Link to={`/invoices/${inv.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-gray-50">
                <span className="font-medium">
                  #{inv.invoice_number} · {t("invoices.forOrder")} #{inv.service_orders?.order_number ?? "—"}
                </span>
                <span className="flex items-center gap-3">
                  <span className="opacity-60 text-sm">{inv.service_orders?.customers?.name ?? ""}</span>
                  <span className="text-sm">{inv.total.toFixed(3)} JOD</span>
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
