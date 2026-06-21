import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { IntakeForm } from "@/features/orders/IntakeForm";
import { useCreateOrder } from "@/features/orders/hooks";
import { useToast } from "@/components/ui/Toast";

export function NewOrderPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const create = useCreateOrder();
  const toast = useToast();

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">{t("orders.newOrder")}</h2>
      <IntakeForm
        submitting={create.isPending}
        onCancel={() => navigate("/orders")}
        onSubmit={(payload) =>
          create.mutate(payload, {
            onSuccess: (o) => navigate(`/orders/${o.id}`),
            onError: () => toast.show(t("errors.saveFailed")),
          })
        }
      />
    </div>
  );
}
