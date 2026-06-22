import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useToast } from "@/components/ui/Toast";
import { useActiveBranch } from "@/features/branches/ActiveBranchContext";
import * as api from "./api";
import type { ItemPayload, SupplierPayload } from "./schema";
import type { MovementType } from "./types";

export function useItems(search = "") {
  const { branchId } = useActiveBranch();
  return useQuery({
    queryKey: ["inventory-items", branchId, search],
    queryFn: () => api.listItems(branchId, search),
  });
}

export function useItem(id: string | undefined) {
  return useQuery({ queryKey: ["inventory-item", id], queryFn: () => api.getItem(id!), enabled: !!id });
}

export function useCreateItem() {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (p: ItemPayload) => api.createItem(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory-items"] }),
    onError: () => toast.show(t("errors.saveFailed")),
  });
}

export function useUpdateItem(id: string) {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (p: ItemPayload) => api.updateItem(id, p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory-items"] });
      qc.invalidateQueries({ queryKey: ["inventory-item", id] });
    },
    onError: () => toast.show(t("errors.saveFailed")),
  });
}

export function useMovements(itemId: string | undefined) {
  const { branchId } = useActiveBranch();
  return useQuery({
    queryKey: ["inventory-movements", itemId, branchId],
    queryFn: () => api.listMovements(itemId!, branchId),
    enabled: !!itemId,
  });
}

function useInvalidateStock(itemId: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["inventory-items"] });
    qc.invalidateQueries({ queryKey: ["inventory-movements", itemId] });
    qc.invalidateQueries({ queryKey: ["inventory-item", itemId] });
  };
}

/** Receive / issue / adjust / count — single ledger row in the active branch. */
export function useStockMovement(itemId: string) {
  const { branchId } = useActiveBranch();
  const toast = useToast();
  const { t } = useTranslation();
  const invalidate = useInvalidateStock(itemId);
  return useMutation({
    mutationFn: (m: {
      type: MovementType;
      quantityDelta: number;
      unitCost?: number | null;
      reference?: string | null;
    }) =>
      api.createMovement({
        itemId,
        branchId: branchId!,
        type: m.type,
        quantityDelta: m.quantityDelta,
        unitCost: m.unitCost,
        reference: m.reference,
      }),
    onSuccess: invalidate,
    onError: () => toast.show(t("errors.saveFailed")),
  });
}

export function useTransferStock(itemId: string) {
  const { branchId } = useActiveBranch();
  const toast = useToast();
  const { t } = useTranslation();
  const invalidate = useInvalidateStock(itemId);
  return useMutation({
    mutationFn: (m: { toBranchId: string; quantity: number; reference?: string | null }) =>
      api.transferStock(itemId, branchId!, m.toBranchId, m.quantity, m.reference),
    onSuccess: invalidate,
    onError: () => toast.show(t("errors.saveFailed")),
  });
}

export function useSuppliers() {
  return useQuery({ queryKey: ["suppliers"], queryFn: api.listSuppliers });
}
export function useCreateSupplier() {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (p: SupplierPayload) => api.createSupplier(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suppliers"] }),
    onError: () => toast.show(t("errors.saveFailed")),
  });
}
export function useUpdateSupplier(id: string) {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (p: SupplierPayload) => api.updateSupplier(id, p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suppliers"] }),
    onError: () => toast.show(t("errors.saveFailed")),
  });
}
