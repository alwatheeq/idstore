import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { paymentSchema, type PaymentFormValues, type PaymentPayload } from "./schema";
import { TextField } from "@/components/ui/TextField";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

type Props = { submitting?: boolean; onSubmit: (p: PaymentPayload) => void; onCancel: () => void };

export function PaymentForm({ submitting, onSubmit, onCancel }: Props) {
  const { t } = useTranslation();
  const { register, handleSubmit, formState: { errors } } = useForm<PaymentFormValues, unknown, PaymentPayload>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { amount: "", method: "cash", note: "" },
  });
  const methodOpts = (["cash", "card", "transfer"] as const).map((m) => ({ value: m, label: t(`paymentMethod.${m}`) }));
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="border rounded-xl p-4 bg-gray-50/50 space-y-3 max-w-md">
      <TextField label={t("invoices.amount")} inputMode="numeric" {...register("amount")} error={errors.amount?.message} />
      <Select label={t("invoices.method")} options={methodOpts} {...register("method")} />
      <TextField label={t("invoices.note")} {...register("note")} error={errors.note?.message} />
      <div className="flex gap-3">
        <Button type="submit" disabled={submitting}>{t("actions.save")}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>{t("actions.cancel")}</Button>
      </div>
    </form>
  );
}
