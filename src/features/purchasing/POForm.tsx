import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { poSchema, type POFormValues, type POPayload } from "./schema";
import { TextField } from "@/components/ui/TextField";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useSuppliers } from "@/features/inventory/hooks";

type Props = { submitting?: boolean; onSubmit: (p: POPayload) => void; onCancel: () => void };

export function POForm({ submitting, onSubmit, onCancel }: Props) {
  const { t } = useTranslation();
  const { data: suppliers } = useSuppliers();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<POFormValues, unknown, POPayload>({
    resolver: zodResolver(poSchema),
    defaultValues: { supplier_id: "", reference: "", notes: "" },
  });
  const supplierOptions = [
    { value: "", label: "—" },
    ...(suppliers ?? []).map((s) => ({ value: s.id, label: s.name })),
  ];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="card space-y-5 p-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Select label={t("po.supplier")} options={supplierOptions} {...register("supplier_id")} />
        <TextField label={t("po.reference")} {...register("reference")} error={errors.reference?.message} />
      </div>
      <TextField label={t("po.notes")} {...register("notes")} error={errors.notes?.message} />
      <div className="flex gap-3 pt-1">
        <Button type="submit" disabled={submitting}>{t("po.create")}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>{t("actions.cancel")}</Button>
      </div>
    </form>
  );
}
