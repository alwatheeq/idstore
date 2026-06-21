import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { intakeSchema, type IntakeFormValues, type IntakePayload } from "./schema";
import { TextField } from "@/components/ui/TextField";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useCustomers, useVehicles } from "@/features/customers/hooks";

type Props = { submitting?: boolean; onSubmit: (p: IntakePayload) => void; onCancel: () => void };

export function IntakeForm({ submitting, onSubmit, onCancel }: Props) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<IntakeFormValues, unknown, IntakePayload>({
    resolver: zodResolver(intakeSchema),
    defaultValues: {
      customer_id: "",
      vehicle_id: "",
      odometer_at_intake: "",
      charge_percent: "",
      hv_battery_state: "",
      reported_concerns: "",
      intake_notes: "",
    },
  });

  const customerId = watch("customer_id");
  const { data: customers } = useCustomers();
  const { data: vehicles } = useVehicles(customerId || undefined);

  // Reset vehicle selection whenever the customer changes so a stale vehicle_id
  // from the previous customer cannot be submitted with the new customer.
  useEffect(() => {
    setValue("vehicle_id", "");
  }, [customerId, setValue]);

  const customerOptions = [
    { value: "", label: "—" },
    ...(customers ?? []).map((c) => ({ value: c.id, label: c.name })),
  ];
  const vehicleOptions = [
    { value: "", label: "—" },
    ...(vehicles ?? []).map((v) => ({
      value: v.id,
      label: [v.model, v.plate_number].filter(Boolean).join(" ") || v.id,
    })),
  ];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-w-xl">
      <Select
        label={t("orders.selectCustomer")}
        options={customerOptions}
        {...register("customer_id")}
        error={errors.customer_id?.message}
      />
      <Select
        label={t("orders.selectVehicle")}
        options={vehicleOptions}
        disabled={!customerId}
        {...register("vehicle_id")}
        error={errors.vehicle_id?.message}
      />
      <div className="grid sm:grid-cols-2 gap-4">
        <TextField
          label={t("orders.odometer")}
          inputMode="numeric"
          {...register("odometer_at_intake")}
          error={errors.odometer_at_intake?.message}
        />
        <TextField
          label={t("orders.charge")}
          inputMode="numeric"
          {...register("charge_percent")}
          error={errors.charge_percent?.message}
        />
      </div>
      <TextField
        label={t("orders.battery")}
        {...register("hv_battery_state")}
        error={errors.hv_battery_state?.message}
      />
      <TextField
        label={t("orders.concerns")}
        {...register("reported_concerns")}
        error={errors.reported_concerns?.message}
      />
      <TextField
        label={t("orders.intakeNotes")}
        {...register("intake_notes")}
        error={errors.intake_notes?.message}
      />
      <div className="flex gap-3 pt-2">
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
