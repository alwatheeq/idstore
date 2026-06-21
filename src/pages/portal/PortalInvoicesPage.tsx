import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useInvoices } from "@/features/invoices/hooks";
import { InvoiceStatusBadge } from "@/features/invoices/InvoiceStatusBadge";

export function PortalInvoicesPage() {
  const { t } = useTranslation();
  const { data: invoices, isLoading } = useInvoices();

  if (isLoading) return <p className="text-sm text-muted">{t("common.loading")}</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight text-ink">{t("portal.invoices")}</h2>
      {!invoices || invoices.length === 0 ? (
        <div className="card grid place-items-center p-12 text-sm text-muted">
          {t("portal.noInvoices")}
        </div>
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {invoices.map((inv) => (
            <li key={inv.id}>
              <Link
                to={`/portal/invoices/${inv.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-paper-2"
              >
                <span className="num font-medium text-ink">#{inv.invoice_number}</span>
                <span className="num text-sm text-muted">
                  {inv.total.toFixed(3)} JOD
                </span>
                <InvoiceStatusBadge status={inv.payment_status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
