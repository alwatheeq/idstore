import { useTranslation } from "react-i18next";
import type { PaymentStatus } from "@/lib/money";

const colors: Record<PaymentStatus, string> = {
  unpaid: "bg-red-100 text-red-700",
  partial: "bg-amber-100 text-amber-700",
  paid: "bg-green-100 text-green-700",
};

export function InvoiceStatusBadge({ status }: { status: PaymentStatus }) {
  const { t } = useTranslation();
  return (
    <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ${colors[status]}`}>
      {t(`paymentStatus.${status}`)}
    </span>
  );
}
