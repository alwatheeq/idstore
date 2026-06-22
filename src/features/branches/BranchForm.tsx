import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { branchSchema, type BranchFormValues, type BranchPayload } from "./schema";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import type { Branch } from "./types";

type Props = {
  defaultValues?: Branch;
  submitting?: boolean;
  onSubmit: (p: BranchPayload) => void;
  onCancel: () => void;
};

export function BranchForm({ defaultValues, submitting, onSubmit, onCancel }: Props) {
  const { t } = useTranslation();
  const initial: BranchFormValues = {
    name: defaultValues?.name ?? "",
    code: defaultValues?.code ?? "",
    phone: defaultValues?.phone ?? "",
    address: defaultValues?.address ?? "",
    is_active: defaultValues?.is_active ?? true,
  };
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BranchFormValues, unknown, BranchPayload>({
    resolver: zodResolver(branchSchema),
    defaultValues: initial,
    values: defaultValues ? initial : undefined,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="card space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label={t("branch.name")} {...register("name")} error={errors.name?.message} />
        <TextField label={t("branch.code")} {...register("code")} error={errors.code?.message} />
        <TextField label={t("branch.phone")} {...register("phone")} error={errors.phone?.message} />
        <TextField
          label={t("branch.address")}
          {...register("address")}
          error={errors.address?.message}
        />
      </div>
      <label className="flex items-center gap-2.5 text-sm text-ink-2">
        <input
          type="checkbox"
          {...register("is_active")}
          className="h-4 w-4 rounded border-line-strong accent-ink"
        />
        {t("branch.active")}
      </label>
      <div className="flex gap-3 pt-1">
        <Button type="submit" disabled={submitting}>
          {t("actions.save")}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t("actions.cancel")}
        </Button>
      </div>
    </form>
  );
}
