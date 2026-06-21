import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { vehicleSchema } from "./schema";
import type { VehicleFormValues, VehiclePayload } from "./schema";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { VehicleImage } from "@/features/vehicles/VehicleImage";
import { VW_EV_MODELS, findModel } from "@/features/vehicles/models";
import type { Vehicle } from "./types";

type Props = {
  defaultValues?: Vehicle;
  submitting?: boolean;
  onSubmit: (payload: VehiclePayload) => void;
  onCancel: () => void;
};

const inputClass =
  "w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-volt-deep";

const OTHER = "__other__";

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
    target_software_version: v.target_software_version ?? "",
    notes: v.notes ?? "",
  };
}

export function VehicleForm({ defaultValues, submitting, onSubmit, onCancel }: Props) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<VehicleFormValues, unknown, VehiclePayload>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      plate_number: defaultValues?.plate_number ?? "",
      vin: defaultValues?.vin ?? "",
      model: defaultValues?.model ?? "",
      model_year: defaultValues?.model_year ?? "",
      color: defaultValues?.color ?? "",
      current_odometer: defaultValues?.current_odometer ?? "",
      hv_battery_state: defaultValues?.hv_battery_state ?? "",
      software_version: defaultValues?.software_version ?? "",
      target_software_version: defaultValues?.target_software_version ?? "",
      notes: defaultValues?.notes ?? "",
    },
    values: defaultValues ? toVehicleFormValues(defaultValues) : undefined,
  });

  // Model is a picker of known VW EV models + "Other" (free text). The stored
  // value is always the plain `model` string; "Other" mode just reveals a text box.
  const modelVal = (watch("model") as string) ?? "";
  const known = findModel(modelVal);
  const [forceOther, setForceOther] = useState(false);
  const isOther = forceOther || (!!modelVal && !known);
  const selectValue = isOther ? OTHER : (known?.key ?? "");

  function onModelSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    if (v === OTHER) {
      setForceOther(true);
      setValue("model", "");
    } else {
      setForceOther(false);
      const m = VW_EV_MODELS.find((x) => x.key === v);
      setValue("model", m?.label ?? "");
    }
  }

  return (
    <form onSubmit={handleSubmit((data) => onSubmit(data))} className="card space-y-5 p-5">
      <div className="grid gap-5 sm:grid-cols-[11rem,1fr] sm:items-start">
        <VehicleImage model={modelVal} className="aspect-[16/10] w-full" />
        <div className="space-y-2">
          <label htmlFor="vehicle-model" className="block text-sm font-medium text-ink-2">
            {t("vehicles.model")}
          </label>
          <select
            id="vehicle-model"
            value={selectValue}
            onChange={onModelSelect}
            className={inputClass}
          >
            <option value="">—</option>
            {VW_EV_MODELS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
            <option value={OTHER}>{t("vehicles.modelOther")}</option>
          </select>
          {isOther && (
            <input
              className={inputClass}
              placeholder={t("vehicles.modelCustomPlaceholder")}
              aria-label={t("vehicles.modelCustom")}
              {...register("model")}
            />
          )}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label={t("vehicles.plate")}
          {...register("plate_number")}
          error={errors.plate_number?.message}
        />
        <TextField label={t("vehicles.vin")} {...register("vin")} error={errors.vin?.message} />
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
        <TextField
          label={t("vehicles.targetSoftware")}
          {...register("target_software_version")}
          error={errors.target_software_version?.message}
        />
      </div>
      <TextField label={t("vehicles.notes")} {...register("notes")} error={errors.notes?.message} />
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
