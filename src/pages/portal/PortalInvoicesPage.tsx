import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useInvoices } from "@/features/invoices/hooks";
import { InvoiceStatusBadge } from "@/features/invoices/InvoiceStatusBadge";

export function PortalInvoicesPage() {
  const { t } = useTranslation();
  const { data: invoices, isLoading } = useInvoices();

  if (isLoading) return <p className="opacity-70">{t("common.loading")}</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{t("portal.invoices")}</h2>
      {!invoices || invoices.length === 0 ? (
        <p className="opacity-70">{t("portal.noInvoices")}</p>
      ) : (
        <ul className="border rounded-xl divide-y">
          {invoices.map((inv) => (
            <li key={inv.id}>
              <Link
                to={`/portal/invoices/${inv.id}`}
                className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-gray-50 transition-colors"
              >
                <span className="font-medium">#{inv.invoice_number}</span>
                <span className="opacity-70 text-sm">
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
