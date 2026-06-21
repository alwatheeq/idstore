import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useInvoice, usePayments } from "@/features/invoices/hooks";
import { sumPayments } from "@/features/invoices/payments";
import { InvoiceStatusBadge } from "@/features/invoices/InvoiceStatusBadge";
import { BackLink } from "@/components/ui/BackLink";
import type { Payment } from "@/features/invoices/types";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="num text-ink-2">{value}</dd>
    </div>
  );
}

export function PortalInvoicePage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const { data: invoice, isLoading } = useInvoice(id);
  const { data: payments } = usePayments(id);
  const fmt = (n: number) => n.toFixed(3);

  if (isLoading) return <p className="text-sm text-muted">{t("common.loading")}</p>;
  if (!invoice) return <p className="text-sm text-muted">{t("portal.noInvoices")}</p>;

  const paid = sumPayments(payments ?? []);
  const balance = Math.max(0, Math.round((invoice.total - paid) * 1000) / 1000);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2 border-b border-line pb-5">
        <BackLink to="/portal/invoices">{t("actions.back")}</BackLink>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h2 className="text-2xl font-bold tracking-tight text-ink">
            {t("portal.invoice")} <span className="num">#{invoice.invoice_number}</span>
          </h2>
          <InvoiceStatusBadge status={invoice.payment_status} />
        </div>
      </div>

      {/* Totals */}
      <dl className="card max-w-xs space-y-1 p-5 text-sm">
        <Row label={t("invoices.subtotal")} value={fmt(invoice.subtotal)} />
        <Row label={t("invoices.discountTotal")} value={fmt(invoice.discount_total)} />
        <div className="flex justify-between gap-4 font-semibold text-ink">
          <dt>{t("invoices.total")}</dt>
          <dd className="num">{fmt(invoice.total)} JOD</dd>
        </div>
        <Row label={t("invoices.paid")} value={fmt(paid)} />
        <div className="flex justify-between gap-4 font-semibold text-ink">
          <dt>{t("invoices.balance")}</dt>
          <dd className="num">{fmt(balance)} JOD</dd>
        </div>
      </dl>

      {/* Payments — read-only list */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold tracking-tight text-ink">{t("invoices.payments")}</h3>
        {!payments || payments.length === 0 ? (
          <div className="card grid place-items-center p-12 text-sm text-muted">
            {t("invoices.noPayments")}
          </div>
        ) : (
          <ul className="card divide-y divide-line overflow-hidden">
            {payments.map((p: Payment) => (
              <li key={p.id} className="flex items-center gap-4 px-4 py-3.5 text-sm">
                <span className="num font-medium text-ink">{fmt(p.amount)} JOD</span>
                <span className="text-muted">
                  · {t(`paymentMethod.${p.method}`)}
                </span>
                {p.note && <span className="text-ink-2">· {p.note}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
