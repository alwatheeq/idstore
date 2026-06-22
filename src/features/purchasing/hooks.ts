import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useToast } from "@/components/ui/Toast";
import { useActiveBranch } from "@/features/branches/ActiveBranchContext";
import * as api from "./api";
import type { POPayload, POLinePayload } from "./schema";
import type { PODetail, POStatus } from "./types";

export function usePurchaseOrders() {
  const { branchId } = useActiveBranch();
  return useQuery({
    queryKey: ["purchase-orders", branchId],
    queryFn: () => api.listPurchaseOrders(branchId),
  });
}

export function usePurchaseOrder(id: string | undefined) {
  return useQuery({
    queryKey: ["purchase-order", id],
    queryFn: () => api.getPurchaseOrder(id!),
    enabled: !!id,
  });
}

export function useCreatePurchaseOrder() {
  const { branchId } = useActiveBranch();
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (p: POPayload) => api.createPurchaseOrder(branchId!, p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchase-orders"] }),
    onError: () => toast.show(t("errors.saveFailed")),
  });
}

function useInvalidatePO(id: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["purchase-order", id] });
    qc.invalidateQueries({ queryKey: ["purchase-orders"] });
  };
}

export function useSetPOStatus(id: string) {
  const toast = useToast();
  const { t } = useTranslation();
  const invalidate = useInvalidatePO(id);
  return useMutation({
    mutationFn: (status: POStatus) => api.setPurchaseOrderStatus(id, status),
    onSuccess: invalidate,
    onError: () => toast.show(t("errors.saveFailed")),
  });
}

export function useAddPOLine(id: string) {
  const toast = useToast();
  const { t } = useTranslation();
  const invalidate = useInvalidatePO(id);
  return useMutation({
    mutationFn: (p: POLinePayload) => api.addPurchaseOrderLine(id, p),
    onSuccess: invalidate,
    onError: () => toast.show(t("errors.saveFailed")),
  });
}

export function useDeletePOLine(id: string) {
  const toast = useToast();
  const { t } = useTranslation();
  const invalidate = useInvalidatePO(id);
  return useMutation({
    mutationFn: (lineId: string) => api.deletePurchaseOrderLine(lineId),
    onSuccess: invalidate,
    onError: () => toast.show(t("errors.saveFailed")),
  });
}

export function useReceivePO(id: string) {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (po: PODetail) => api.receivePurchaseOrder(po),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-order", id] });
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      qc.invalidateQueries({ queryKey: ["inventory-items"] });
    },
    onError: () => toast.show(t("errors.saveFailed")),
  });
}
