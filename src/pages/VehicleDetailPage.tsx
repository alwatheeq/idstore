import { useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useVehicle } from "@/features/customers/hooks";
import { useOrdersByVehicle } from "@/features/orders/hooks";
import {
  useVehicleUpdates,
  useCreateSoftwareUpdate,
  useDeleteSoftwareUpdate,
} from "@/features/software/hooks";
import { SoftwareUpdateForm } from "@/features/software/SoftwareUpdateForm";
import { SoftwareHistory } from "@/features/software/SoftwareHistory";
import { SoftwareDueBadge } from "@/features/software/SoftwareDueBadge";
import { VehicleImage } from "@/features/vehicles/VehicleImage";
import { Button } from "@/components/ui/Button";
import { BackLink } from "@/components/ui/BackLink";

export function VehicleDetailPage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const { data: vehicle, isLoading } = useVehicle(id);
  const { data: orders } = useOrdersByVehicle(id);
  const { data: updates } = useVehicleUpdates(id);
  const create = useCreateSoftwareUpdate(id, vehicle?.branch_id ?? "");
  const remove = useDeleteSoftwareUpdate(id);
  const [logging, setLogging] = useState(false);

  if (isLoading) return <p className="text-sm text-muted">{t("common.loading")}</p>;
  if (!vehicle) return <p className="text-sm text-muted">{t("software.vehicleNotFound")}</p>;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
        <div className="flex items-start gap-4">
          <VehicleImage model={vehicle.model} className="h-20 w-28 flex-shrink-0" />
          <div className="space-y-2">
            <BackLink to={`/customers/${vehicle.customer_id}`}>{t("actions.back")}</BackLink>
            <h2 className="text-2xl font-bold tracking-tight text-ink">{vehicle.model ?? "—"}</h2>
            <p className="num text-sm text-muted">
              {[vehicle.plate_number, vehicle.vin].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <SoftwareDueBadge vehicle={vehicle} />
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold tracking-tight text-ink">{t("software.title")}</h3>
          {!logging && <Button onClick={() => setLogging(true)}>{t("software.logUpdate")}</Button>}
        </div>

        <div className="card p-5">
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-1">
              <div className="micro">{t("software.currentVersion")}</div>
              <div className="num text-lg font-semibold text-ink">
                {vehicle.software_version ?? "—"}
              </div>
            </div>
            <div className="space-y-1">
              <div className="micro">{t("software.targetVersion")}</div>
              <div className="num text-lg font-semibold text-ink">
                {vehicle.target_software_version ?? "—"}
              </div>
            </div>
          </div>
          <p className="micro mt-4">{t("software.targetHint")}</p>
        </div>

        {logging && (
          <SoftwareUpdateForm
            currentVersion={vehicle.software_version}
            orders={orders ?? []}
            submitting={create.isPending}
            onSubmit={(payload, setCurrent) =>
              create.mutate({ payload, setCurrent }, { onSuccess: () => setLogging(false) })
            }
            onCancel={() => setLogging(false)}
          />
        )}

        <SoftwareHistory
          updates={updates ?? []}
          onDelete={(uid) => {
            if (confirm(t("actions.confirmDelete"))) remove.mutate(uid);
          }}
        />
      </section>
    </div>
  );
}
