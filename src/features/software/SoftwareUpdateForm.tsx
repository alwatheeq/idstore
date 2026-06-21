import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { softwareUpdateSchema } from "./schema";
import type { SoftwareUpdateFormValues, SoftwareUpdatePayload } from "./schema";
import { TextField } from "@/components/ui/TextField";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

type Props = {
  currentVersion?: string | null;
  orders?: { id: string; order_number: number }[];
  submitting?: boolean;
  onSubmit: (payload: SoftwareUpdatePayload, setCurrent: boolean) => void;
  onCancel: () => void;
};

const today = () => new Date().toISOString().slice(0, 10);

export function SoftwareUpdateForm({
  currentVersion,
  orders = [],
  submitting,
  onSubmit,
  onCancel,
}: Props) {
  const { t } = useTranslation();
  const [setCurrent, setSetCurrent] = useState(true);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SoftwareUpdateFormValues, unknown, SoftwareUpdatePayload>({
    resolver: zodResolver(softwareUpdateSchema),
    defaultValues: {
      from_version: currentVersion ?? "",
      to_version: "",
      applied_at: today(),
      notes: "",
      service_order_id: "",
    },
  });

  return (
    <form onSubmit={handleSubmit((d) => onSubmit(d, setCurrent))} className="card space-y-5 p-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label={t("software.fromVersion")}
          {...register("from_version")}
          error={errors.from_version?.message}
        />
        <TextField
          label={t("software.toVersion")}
          {...register("to_version")}
          error={errors.to_version?.message}
        />
        <TextField
          label={t("software.appliedAt")}
          type="date"
          {...register("applied_at")}
          error={errors.applied_at?.message}
        />
        {orders.length > 0 && (
          <Select
            label={t("software.linkOrder")}
            {...register("service_order_id")}
            options={[
              { value: "", label: t("software.noOrder") },
              ...orders.map((o) => ({ value: o.id, label: `#${o.order_number}` })),
            ]}
          />
        )}
      </div>
      <TextField label={t("vehicles.notes")} {...register("notes")} error={errors.notes?.message} />
      <label className="flex items-center gap-2.5 text-sm text-ink-2">
        <input
          type="checkbox"
          checked={setCurrent}
          onChange={(e) => setSetCurrent(e.target.checked)}
          className="h-4 w-4 rounded border-line-strong accent-ink"
        />
        {t("software.alsoSetCurrent")}
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
