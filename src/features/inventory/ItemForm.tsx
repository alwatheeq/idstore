import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { itemSchema, type ItemFormValues, type ItemPayload } from "./schema";
import { TextField } from "@/components/ui/TextField";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useSuppliers } from "./hooks";
import type { InventoryItem } from "./types";

type Props = {
  defaultValues?: InventoryItem;
  submitting?: boolean;
  onSubmit: (p: ItemPayload) => void;
  onCancel: () => void;
};

export function ItemForm({ defaultValues: dv, submitting, onSubmit, onCancel }: Props) {
  const { t } = useTranslation();
  const { data: suppliers } = useSuppliers();
  const init: ItemFormValues = {
    name: dv?.name ?? "",
    sku: dv?.sku ?? "",
    category: dv?.category ?? "",
    unit: dv?.unit ?? "pcs",
    cost: dv?.cost ?? 0,
    sale_price: dv?.sale_price ?? 0,
    reorder_level: dv?.reorder_level ?? 0,
    supplier_id: dv?.supplier_id ?? "",
    is_active: dv?.is_active ?? true,
  };
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ItemFormValues, unknown, ItemPayload>({
    resolver: zodResolver(itemSchema),
    defaultValues: init,
    values: dv ? init : undefined,
  });
  const supplierOptions = [
    { value: "", label: "—" },
    ...(suppliers ?? []).map((s) => ({ value: s.id, label: s.name })),
  ];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="card space-y-5 p-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label={t("inventory.itemName")} {...register("name")} error={errors.name?.message} />
        <TextField label={t("inventory.sku")} {...register("sku")} error={errors.sku?.message} />
        <TextField label={t("inventory.category")} {...register("category")} error={errors.category?.message} />
        <TextField label={t("inventory.unit")} {...register("unit")} error={errors.unit?.message} />
        <TextField label={t("inventory.cost")} inputMode="decimal" {...register("cost")} error={errors.cost?.message} />
        <TextField label={t("inventory.salePrice")} inputMode="decimal" {...register("sale_price")} error={errors.sale_price?.message} />
        <TextField label={t("inventory.reorderLevel")} inputMode="decimal" {...register("reorder_level")} error={errors.reorder_level?.message} />
        <Select label={t("inventory.supplier")} options={supplierOptions} {...register("supplier_id")} />
      </div>
      <label className="flex items-center gap-2.5 text-sm text-ink-2">
        <input type="checkbox" {...register("is_active")} className="h-4 w-4 rounded border-line-strong accent-ink" />
        {t("inventory.active")}
      </label>
      <div className="flex gap-3 pt-1">
        <Button type="submit" disabled={submitting}>{t("actions.save")}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>{t("actions.cancel")}</Button>
      </div>
    </form>
  );
}
