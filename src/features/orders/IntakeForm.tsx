import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { intakeSchema, type IntakeFormValues, type IntakePayload } from "./schema";
import { TextField } from "@/components/ui/TextField";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { ConcernsField } from "./ConcernsField";
import { useLastOdometer } from "./hooks";
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
      concerns: [],
    },
  });

  const concernKeys = (watch("concerns") ?? []).map((c) => c.key);

  const customerId = watch("customer_id");
  const vehicleId = watch("vehicle_id");
  const { data: customers } = useCustomers();
  const { data: vehicles } = useVehicles(customerId || undefined);
  const { data: lastOdometer } = useLastOdometer(vehicleId || undefined);
  // Previous reading = latest from this vehicle's service history, else the
  // vehicle's stored odometer. Shown above the field so the new reading can be
  // sanity-checked (and tapped to prefill).
  const prevOdometer =
    lastOdometer ?? (vehicles ?? []).find((v) => v.id === vehicleId)?.current_odometer ?? null;

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
        <div className="space-y-1.5">
          {prevOdometer != null && (
            <button
              type="button"
              onClick={() => setValue("odometer_at_intake", String(prevOdometer))}
              className="num text-xs font-medium text-volt-deep transition-colors hover:underline"
            >
              {t("orders.previousOdometer", { km: prevOdometer.toLocaleString() })}
            </button>
          )}
          <TextField
            label={t("orders.odometer")}
            inputMode="numeric"
            {...register("odometer_at_intake")}
            error={errors.odometer_at_intake?.message}
          />
        </div>
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
      <div className="space-y-2">
        <label className="block text-sm font-medium text-ink-2">
          {t("orders.reportedConcerns")}
        </label>
        <ConcernsField
          value={concernKeys}
          onChange={(keys) =>
            setValue(
              "concerns",
              keys.map((k) => ({ key: k, checked: false })),
            )
          }
        />
      </div>
      <TextField
        label={t("orders.otherConcerns")}
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
