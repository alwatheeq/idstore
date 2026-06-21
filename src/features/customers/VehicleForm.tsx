import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { vehicleSchema } from "./schema";
import type { VehicleFormValues, VehiclePayload } from "./schema";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import type { Vehicle } from "./types";

type Props = {
  defaultValues?: Vehicle;
  submitting?: boolean;
  onSubmit: (payload: VehiclePayload) => void;
  onCancel: () => void;
};

/** Map a Vehicle (which uses null for optional fields) to the string-based form input shape. */
function toVehicleFormValues(v: Vehicle): VehicleFormValues {
  return {
    plate_number: v.plate_number ?? "",
    vin: v.vin ?? "",
    model: v.model ?? "",
    // model_year and current_odometer are number | null; "" renders an empty numeric input
    model_year: v.model_year ?? "",
    color: v.color ?? "",
    current_odometer: v.current_odometer ?? "",
    hv_battery_state: v.hv_battery_state ?? "",
    software_version: v.software_version ?? "",
    notes: v.notes ?? "",
  };
}

export function VehicleForm({ defaultValues, submitting, onSubmit, onCancel }: Props) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VehicleFormValues, unknown, VehiclePayload>({
    resolver: zodResolver(vehicleSchema),
    // Static initial values keep inputs controlled from the first render.
    defaultValues: {
      plate_number: defaultValues?.plate_number ?? "",
      vin: defaultValues?.vin ?? "",
      model: defaultValues?.model ?? "",
      model_year: defaultValues?.model_year ?? "",
      color: defaultValues?.color ?? "",
      current_odometer: defaultValues?.current_odometer ?? "",
      hv_battery_state: defaultValues?.hv_battery_state ?? "",
      software_version: defaultValues?.software_version ?? "",
      notes: defaultValues?.notes ?? "",
    },
    // `values` re-populates the form whenever async Vehicle data arrives
    // (react-hook-form calls reset() internally on each new reference).
    // Without this, editing an existing vehicle would show a blank form until
    // the user refreshed, because defaultValues is only read at mount time.
    values: defaultValues ? toVehicleFormValues(defaultValues) : undefined,
  });

  return (
    <form onSubmit={handleSubmit((data) => onSubmit(data))} className="border rounded-xl p-5 space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <TextField
          label={t("vehicles.plate")}
          {...register("plate_number")}
          error={errors.plate_number?.message}
        />
        <TextField
          label={t("vehicles.vin")}
          {...register("vin")}
          error={errors.vin?.message}
        />
        <TextField
          label={t("vehicles.model")}
          {...register("model")}
          error={errors.model?.message}
        />
        <TextField
          label={t("vehicles.year")}
          inputMode="numeric"
          {...register("model_year")}
          error={errors.model_year?.message}
        />
        <TextField
          label={t("vehicles.color")}
          {...register("color")}
          error={errors.color?.message}
        />
        <TextField
          label={t("vehicles.odometer")}
          inputMode="numeric"
          {...register("current_odometer")}
          error={errors.current_odometer?.message}
        />
        <TextField
          label={t("vehicles.battery")}
          {...register("hv_battery_state")}
          error={errors.hv_battery_state?.message}
        />
        <TextField
          label={t("vehicles.software")}
          {...register("software_version")}
          error={errors.software_version?.message}
        />
      </div>
      <TextField
        label={t("vehicles.notes")}
        {...register("notes")}
        error={errors.notes?.message}
      />
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={submitting}>{t("actions.save")}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>{t("actions.cancel")}</Button>
      </div>
    </form>
  );
}
