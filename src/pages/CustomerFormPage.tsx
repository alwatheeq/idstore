import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CustomerForm } from "@/features/customers/CustomerForm";
import { useCustomer, useCreateCustomer, useUpdateCustomer } from "@/features/customers/hooks";
import type { CustomerPayload } from "@/features/customers/schema";

export function CustomerFormPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const { data: existing } = useCustomer(id);
  const create = useCreateCustomer();
  const update = useUpdateCustomer(id ?? "");

  const isPending = isEdit ? update.isPending : create.isPending;

  function handleSubmit(payload: CustomerPayload) {
    if (isEdit) {
      update.mutate(payload, {
        onSuccess: () => navigate(`/customers/${id}`),
      });
    } else {
      create.mutate(payload, {
        onSuccess: (saved) => navigate(`/customers/${saved.id}`),
      });
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">
        {isEdit ? t("customers.editCustomer") : t("customers.newCustomer")}
      </h2>
      <CustomerForm
        defaultValues={existing}
        submitting={isPending}
        onCancel={() => navigate(isEdit ? `/customers/${id}` : "/customers")}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
