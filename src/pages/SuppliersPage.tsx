import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { BackLink } from "@/components/ui/BackLink";
import { useSuppliers, useCreateSupplier, useUpdateSupplier } from "@/features/inventory/hooks";
import { SupplierForm } from "@/features/inventory/SupplierForm";
import type { Supplier } from "@/features/inventory/types";

function SupplierEditForm({ supplier, onClose }: { supplier: Supplier; onClose: () => void }) {
  const update = useUpdateSupplier(supplier.id);
  return (
    <SupplierForm
      defaultValues={supplier}
      submitting={update.isPending}
      onCancel={onClose}
      onSubmit={(p) => update.mutate(p, { onSuccess: onClose })}
    />
  );
}

export function SuppliersPage() {
  const { t } = useTranslation();
  const { data: suppliers, isLoading } = useSuppliers();
  const create = useCreateSupplier();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <BackLink to="/inventory">{t("actions.back")}</BackLink>
        <PageHeader
          title={t("inventory.suppliers")}
          eyebrow={t("nav.inventory")}
          actions={
            !adding && (
              <Button
                onClick={() => {
                  setAdding(true);
                  setEditingId(null);
                }}
              >
                {t("inventory.addSupplier")}
              </Button>
            )
          }
        />
      </div>

      {adding && (
        <SupplierForm
          submitting={create.isPending}
          onCancel={() => setAdding(false)}
          onSubmit={(p) => create.mutate(p, { onSuccess: () => setAdding(false) })}
        />
      )}

      {isLoading ? (
        <p className="text-sm text-muted">{t("common.loading")}</p>
      ) : (suppliers ?? []).length === 0 ? (
        <div className="card grid place-items-center p-12 text-sm text-muted">
          {t("inventory.noSuppliers")}
        </div>
      ) : (
        <ul className="space-y-3">
          {(suppliers ?? []).map((s) =>
            editingId === s.id ? (
              <li key={s.id}>
                <SupplierEditForm supplier={s} onClose={() => setEditingId(null)} />
              </li>
            ) : (
              <li key={s.id} className="card flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="font-medium text-ink">{s.name}</div>
                  <div className="text-sm text-muted">
                    {[s.contact, s.phone, s.email].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditingId(s.id);
                    setAdding(false);
                  }}
                >
                  {t("actions.edit")}
                </Button>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
