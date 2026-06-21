import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button, buttonClasses } from "@/components/ui/Button";
import { VehicleForm } from "@/features/customers/VehicleForm";
import type { Vehicle } from "@/features/customers/types";
import {
  useCustomer,
  useDeleteCustomer,
  useVehicles,
  useCreateVehicle,
  useUpdateVehicle,
  useDeleteVehicle,
} from "@/features/customers/hooks";

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

  if (isLoading) return <p className="opacity-70">{t("common.loading")}</p>;
  if (!customer) return <p className="opacity-70">{t("customers.empty")}</p>;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Link to="/customers" className="text-sm opacity-60 hover:opacity-100">
            ← {t("actions.back")}
          </Link>
          <h2 className="text-2xl font-bold">{customer.name}</h2>
          <p className="opacity-70 text-sm">
            {customer.phone ?? ""} {customer.email ? `· ${customer.email}` : ""}
          </p>
          {customer.notes && (
            <p className="opacity-80 text-sm pt-1">{customer.notes}</p>
          )}
        </div>
        <div className="flex gap-2">
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
          <h3 className="text-lg font-semibold">{t("vehicles.title")}</h3>
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
          <VehicleForm
            submitting={createVehicle.isPending}
            onCancel={() => setAdding(false)}
            onSubmit={(payload) =>
              createVehicle.mutate(payload, { onSuccess: () => setAdding(false) })
            }
          />
        )}

        {!vehicles || vehicles.length === 0 ? (
          !adding && <p className="opacity-70">{t("vehicles.empty")}</p>
        ) : (
          <ul className="space-y-3">
            {vehicles.map((v: Vehicle) => (
              <li key={v.id} className="border rounded-xl p-4">
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
                    <div className="space-y-0.5">
                      <p className="font-medium">
                        {v.model ?? "—"}{" "}
                        {v.model_year ? `(${v.model_year})` : ""}
                      </p>
                      <p className="text-sm opacity-70">
                        {v.plate_number ?? ""}
                        {v.vin ? ` · ${v.vin}` : ""}
                        {v.current_odometer != null
                          ? ` · ${v.current_odometer} km`
                          : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
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
                          if (confirm(t("actions.confirmDelete")))
                            deleteVehicle.mutate(v.id);
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
    </div>
  );
}
