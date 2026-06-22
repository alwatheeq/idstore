import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { supplierSchema, type SupplierFormValues, type SupplierPayload } from "./schema";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import type { Supplier } from "./types";

type Props = {
  defaultValues?: Supplier;
  submitting?: boolean;
  onSubmit: (p: SupplierPayload) => void;
  onCancel: () => void;
};

export function SupplierForm({ defaultValues: dv, submitting, onSubmit, onCancel }: Props) {
  const { t } = useTranslation();
  const init: SupplierFormValues = {
    name: dv?.name ?? "",
    contact: dv?.contact ?? "",
    phone: dv?.phone ?? "",
    email: dv?.email ?? "",
  };
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SupplierFormValues, unknown, SupplierPayload>({
    resolver: zodResolver(supplierSchema),
    defaultValues: init,
    values: dv ? init : undefined,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="card space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label={t("inventory.supplierName")} {...register("name")} error={errors.name?.message} />
        <TextField label={t("inventory.contact")} {...register("contact")} error={errors.contact?.message} />
        <TextField label={t("inventory.phone")} {...register("phone")} error={errors.phone?.message} />
        <TextField label={t("inventory.email")} {...register("email")} error={errors.email?.message} />
      </div>
      <div className="flex gap-3 pt-1">
        <Button type="submit" disabled={submitting}>{t("actions.save")}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>{t("actions.cancel")}</Button>
      </div>
    </form>
  );
}
