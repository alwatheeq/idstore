import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button, buttonClasses } from "@/components/ui/Button";
import { BackLink } from "@/components/ui/BackLink";
import { Link } from "react-router-dom";
import { VehicleForm } from "@/features/customers/VehicleForm";
import { VehicleImage } from "@/features/vehicles/VehicleImage";
import type { Vehicle } from "@/features/customers/types";
import {
  useCustomer,
  useDeleteCustomer,
  useVehicles,
  useCreateVehicle,
  useUpdateVehicle,
  useDeleteVehicle,
} from "@/features/customers/hooks";
import { PortalAccessPanel } from "@/features/portal/PortalAccessPanel";

export function CustomerDetailPage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const navigate = useNavigate();

  const { data: customer, isLoading } = useCustomer(id);
  const deleteCustomer = useDeleteCustomer();
  const { data: vehicles } = useVehicles(id);
  const createVehicle = useCreateVehicle(id);
  const updateVehicle = useUpdateVehicle(id);
  const deleteVehicle = useDeleteVehicle(id);

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (isLoading) return <p className="text-sm text-muted">{t("common.loading")}</p>;
  if (!customer) return <p className="text-sm text-muted">{t("customers.notFound")}</p>;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
        <div className="space-y-2">
          <BackLink to="/customers">{t("actions.back")}</BackLink>
          <h2 className="text-2xl font-bold tracking-tight text-ink">{customer.name}</h2>
          <p className="text-sm text-muted">
            <span className="num">{customer.phone ?? ""}</span>
            {customer.email ? ` · ${customer.email}` : ""}
          </p>
          {customer.notes && <p className="pt-1 text-sm text-ink-2">{customer.notes}</p>}
        </div>
        <div className="flex flex-shrink-0 gap-2">
          <Link to={`/customers/${id}/edit`} className={buttonClasses("ghost")}>
            {t("actions.edit")}
          </Link>
          <Button
            variant="danger"
            onClick={() => {
              if (confirm(t("actions.confirmDelete")))
                deleteCustomer.mutate(id, {
                  onSuccess: () => navigate("/customers"),
                });
            }}
          >
            {t("actions.delete")}
          </Button>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold tracking-tight text-ink">{t("vehicles.title")}</h3>
          {!adding && (
            <Button
              onClick={() => {
                setAdding(true);
                setEditingId(null);
              }}
            >
              {t("vehicles.addVehicle")}
            </Button>
          )}
        </div>

        {adding && (
          <div className="card p-5">
            <VehicleForm
              submitting={createVehicle.isPending}
              onCancel={() => setAdding(false)}
              onSubmit={(payload) =>
                createVehicle.mutate(payload, { onSuccess: () => setAdding(false) })
              }
            />
          </div>
        )}

        {!vehicles || vehicles.length === 0 ? (
          !adding && (
            <div className="card grid place-items-center p-10 text-sm text-muted">
              {t("vehicles.empty")}
            </div>
          )
        ) : (
          <ul className="space-y-3">
            {vehicles.map((v: Vehicle) => (
              <li key={v.id} className="card p-5">
                {editingId === v.id ? (
                  <VehicleForm
                    defaultValues={v}
                    submitting={updateVehicle.isPending}
                    onCancel={() => setEditingId(null)}
                    onSubmit={(payload) =>
                      updateVehicle.mutate(
                        { id: v.id, payload },
                        { onSuccess: () => setEditingId(null) },
                      )
                    }
                  />
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-4">
                      <VehicleImage model={v.model} className="h-14 w-20 flex-shrink-0" />
                      <div className="space-y-1">
                        <p className="font-medium text-ink">
                          {v.model ?? "—"}{" "}
                          {v.model_year ? (
                            <span className="num text-muted">({v.model_year})</span>
                          ) : (
                            ""
                          )}
                        </p>
                        <p className="text-sm text-muted">
                          <span className="num">{v.plate_number ?? ""}</span>
                          {v.vin ? <> · <span className="num">{v.vin}</span></> : ""}
                          {v.current_odometer != null ? (
                            <> · <span className="num">{v.current_odometer}</span> km</>
                          ) : (
                            ""
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 gap-2">
                      <Link to={`/vehicles/${v.id}`} className={buttonClasses("ghost")}>
                        {t("software.title")}
                      </Link>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setEditingId(v.id);
                          setAdding(false);
                        }}
                      >
                        {t("actions.edit")}
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => {
                          if (confirm(t("actions.confirmDelete"))) deleteVehicle.mutate(v.id);
                        }}
                      >
                        {t("actions.delete")}
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <PortalAccessPanel customer={customer} />
    </div>
  );
}
