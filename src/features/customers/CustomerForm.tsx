import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { customerSchema } from "./schema";
import type { CustomerFormValues, CustomerPayload } from "./schema";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import type { Customer } from "./types";

type Props = {
  defaultValues?: Customer;
  submitting?: boolean;
  onSubmit: (payload: CustomerPayload) => void;
  onCancel: () => void;
};

export function CustomerForm({ defaultValues, submitting, onSubmit, onCancel }: Props) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerFormValues, unknown, CustomerPayload>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      phone: defaultValues?.phone ?? "",
      email: defaultValues?.email ?? "",
      notes: defaultValues?.notes ?? "",
    },
  });

  return (
    <form onSubmit={handleSubmit((data) => onSubmit(data))} className="space-y-5 max-w-md">
      <TextField label={t("customers.name")} {...register("name")} error={errors.name?.message} />
      <TextField label={t("customers.phone")} {...register("phone")} error={errors.phone?.message} />
      <TextField label={t("customers.email")} type="email" {...register("email")} error={errors.email?.message} />
      <TextField label={t("customers.notes")} {...register("notes")} error={errors.notes?.message} />
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={submitting}>{t("actions.save")}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>{t("actions.cancel")}</Button>
      </div>
    </form>
  );
}
