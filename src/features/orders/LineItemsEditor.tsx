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

type FormProps = {
  defaultValues?: ServiceOrderLine;
  submitting?: boolean;
  onSubmit: (p: LinePayload) => void;
  onCancel: () => void;
};

function LineForm({ defaultValues, submitting, onSubmit, onCancel }: FormProps) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
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
    },
    values: defaultValues
      ? {
          line_type: defaultValues.line_type,
          description: defaultValues.description,
          quantity: defaultValues.quantity,
          unit_price: defaultValues.unit_price,
          discount_type: defaultValues.discount_type,
          discount_value: defaultValues.discount_value,
        }
      : undefined,
  });

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
      className="border rounded-xl p-4 bg-gray-50/50 space-y-3"
    >
      <div className="grid sm:grid-cols-2 gap-3">
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
          label={t("orders.discount")}
          options={discOpts}
          {...register("discount_type")}
        />
        <TextField
          label={t("orders.discount")}
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

export function LineItemsEditor({ orderId }: { orderId: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { data: lines } = useLines(orderId);
  const create = useCreateLine(orderId);
  const update = useUpdateLine(orderId);
  const del = useDeleteLine(orderId);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const onErr = () => toast.show(t("errors.saveFailed"));
  const totals = computeOrderTotals(lines ?? []);
  const fmt = (n: number) => n.toFixed(3);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t("orders.lines")}</h3>
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

      {lines && lines.length > 0 && (
        <div className="border rounded-lg divide-y">
          {lines.map((l: ServiceOrderLine) => (
            <div key={l.id} className="p-3">
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
                  <span className="flex-1">
                    {l.description}{" "}
                    <span className="opacity-50">· {t(`lineType.${l.line_type}`)}</span>
                  </span>
                  <span className="opacity-70">
                    {l.quantity} × {fmt(l.unit_price)}
                  </span>
                  <span className="font-medium">{fmt(l.line_total)}</span>
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
        <dl className="max-w-xs ms-auto space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="opacity-60">{t("orders.subtotal")}</dt>
            <dd>{fmt(totals.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="opacity-60">{t("orders.discountTotal")}</dt>
            <dd>{fmt(totals.discountTotal)}</dd>
          </div>
          <div className="flex justify-between font-semibold">
            <dt>{t("orders.grandTotal")}</dt>
            <dd>{fmt(totals.total)} JOD</dd>
          </div>
        </dl>
      )}
    </section>
  );
}
