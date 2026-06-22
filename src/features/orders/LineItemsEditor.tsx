import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { lineSchema } from "./schema";
import type { LineFormValues, LinePayload } from "./schema";
import { useLines, useCreateLine, useUpdateLine, useDeleteLine } from "./hooks";
import { computeOrderTotals } from "./lineMath";
import type { ServiceOrderLine } from "./types";
import { TextField } from "@/components/ui/TextField";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useItems } from "@/features/inventory/hooks";

type FormProps = {
  defaultValues?: ServiceOrderLine;
  submitting?: boolean;
  onSubmit: (p: LinePayload) => void;
  onCancel: () => void;
};

function LineForm({ defaultValues, submitting, onSubmit, onCancel }: FormProps) {
  const { t } = useTranslation();
  const { data: items } = useItems();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<LineFormValues, unknown, LinePayload>({
    resolver: zodResolver(lineSchema),
    defaultValues: {
      line_type: defaultValues?.line_type ?? "service",
      description: defaultValues?.description ?? "",
      quantity: defaultValues?.quantity ?? 1,
      unit_price: defaultValues?.unit_price ?? 0,
      discount_type: defaultValues?.discount_type ?? "none",
      discount_value: defaultValues?.discount_value ?? 0,
      inventory_item_id: defaultValues?.inventory_item_id ?? "",
    },
    values: defaultValues
      ? {
          line_type: defaultValues.line_type,
          description: defaultValues.description,
          quantity: defaultValues.quantity,
          unit_price: defaultValues.unit_price,
          discount_type: defaultValues.discount_type,
          discount_value: defaultValues.discount_value,
          inventory_item_id: defaultValues.inventory_item_id ?? "",
        }
      : undefined,
  });

  const linkedItem = (watch("inventory_item_id") as string) ?? "";
  const itemOptions = [
    { value: "", label: t("orders.noStockItem") },
    ...(items ?? []).map((i) => ({ value: i.id, label: i.sku ? `${i.name} · ${i.sku}` : i.name })),
  ];
  function pickItem(id: string) {
    setValue("inventory_item_id", id);
    const it = items?.find((i) => i.id === id);
    if (it) {
      setValue("description", it.name);
      setValue("unit_price", it.sale_price);
      setValue("line_type", "part");
    }
  }

  const typeOpts = (["service", "part", "fee"] as const).map((v) => ({
    value: v,
    label: t(`lineType.${v}`),
  }));
  const discOpts = (["none", "amount", "percent"] as const).map((v) => ({
    value: v,
    label: t(`discountType.${v}`),
  }));

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-3 rounded-xl border border-line bg-paper-2 p-4"
    >
      {itemOptions.length > 1 && (
        <Select
          label={t("orders.fromStock")}
          options={itemOptions}
          value={linkedItem}
          onChange={(e) => pickItem(e.target.value)}
        />
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label={t("orders.lineType")}
          options={typeOpts}
          {...register("line_type")}
        />
        <TextField
          label={t("orders.description")}
          {...register("description")}
          error={errors.description?.message}
        />
        <TextField
          label={t("orders.qty")}
          inputMode="numeric"
          {...register("quantity")}
          error={errors.quantity?.message}
        />
        <TextField
          label={t("orders.unitPrice")}
          inputMode="numeric"
          {...register("unit_price")}
          error={errors.unit_price?.message}
        />
        <Select
          label={t("orders.discountType")}
          options={discOpts}
          {...register("discount_type")}
        />
        <TextField
          label={t("orders.discountValue")}
          inputMode="numeric"
          {...register("discount_value")}
          error={errors.discount_value?.message}
        />
      </div>
      <div className="flex gap-3">
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

export function LineItemsEditor({ orderId, branchId }: { orderId: string; branchId: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { data: lines } = useLines(orderId);
  const create = useCreateLine(orderId, branchId);
  const update = useUpdateLine(orderId, branchId);
  const del = useDeleteLine(orderId, branchId);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const onErr = () => toast.show(t("errors.saveFailed"));
  const totals = computeOrderTotals(lines ?? []);
  const fmt = (n: number) => n.toFixed(3);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold tracking-tight text-ink">{t("orders.lines")}</h3>
        {!adding && (
          <Button
            onClick={() => {
              setAdding(true);
              setEditingId(null);
            }}
          >
            {t("orders.addLine")}
          </Button>
        )}
      </div>

      {adding && (
        <LineForm
          submitting={create.isPending}
          onCancel={() => setAdding(false)}
          onSubmit={(p) =>
            create.mutate(p, { onSuccess: () => setAdding(false), onError: onErr })
          }
        />
      )}

      {lines && lines.length === 0 && !adding && (
        <div className="card grid place-items-center p-10 text-sm text-muted">
          {t("orders.noLines")}
        </div>
      )}

      {lines && lines.length > 0 && (
        <div className="card divide-y divide-line overflow-hidden">
          {lines.map((l: ServiceOrderLine) => (
            <div key={l.id} className="p-3 transition-colors hover:bg-paper-2">
              {editingId === l.id ? (
                <LineForm
                  defaultValues={l}
                  submitting={update.isPending}
                  onCancel={() => setEditingId(null)}
                  onSubmit={(p) =>
                    update.mutate(
                      { id: l.id, payload: p },
                      { onSuccess: () => setEditingId(null), onError: onErr }
                    )
                  }
                />
              ) : (
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="flex-1 text-ink">
                    {l.description}{" "}
                    <span className="text-muted">· {t(`lineType.${l.line_type}`)}</span>
                  </span>
                  <span className="num text-muted">
                    {l.quantity} × {fmt(l.unit_price)}
                  </span>
                  <span className="num font-medium text-ink">{fmt(l.line_total)}</span>
                  <span className="flex gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setEditingId(l.id);
                        setAdding(false);
                      }}
                    >
                      {t("actions.edit")}
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => {
                        if (confirm(t("actions.confirmDelete"))) {
                          del.mutate(l.id, { onError: onErr });
                        }
                      }}
                    >
                      {t("actions.delete")}
                    </Button>
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {(lines?.length ?? 0) > 0 && (
        <dl className="ms-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">{t("orders.subtotal")}</dt>
            <dd className="num text-ink">{fmt(totals.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">{t("orders.discountTotal")}</dt>
            <dd className="num text-ink">{fmt(totals.discountTotal)}</dd>
          </div>
          <div className="flex justify-between font-semibold text-ink">
            <dt>{t("orders.grandTotal")}</dt>
            <dd className="num">{fmt(totals.total)} JOD</dd>
          </div>
        </dl>
      )}
    </section>
  );
}
