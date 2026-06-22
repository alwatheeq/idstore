import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useToast } from "@/components/ui/Toast";
import { useActiveBranch } from "@/features/branches/ActiveBranchContext";
import * as api from "./api";
import type { SoftwareUpdatePayload } from "./schema";

export function useVehicleUpdates(vehicleId: string | undefined) {
  return useQuery({
    queryKey: ["softwareUpdates", vehicleId],
    queryFn: () => api.listVehicleUpdates(vehicleId!),
    enabled: !!vehicleId,
  });
}

export function useDueVehicles() {
  const { branchId } = useActiveBranch();
  return useQuery({
    queryKey: ["dueVehicles", branchId],
    queryFn: () => api.listDueVehicles(branchId),
  });
}

export function useCreateSoftwareUpdate(vehicleId: string, branchId: string) {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ payload, setCurrent }: { payload: SoftwareUpdatePayload; setCurrent: boolean }) =>
      api.createSoftwareUpdate(vehicleId, payload, setCurrent, branchId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["softwareUpdates", vehicleId] });
      qc.invalidateQueries({ queryKey: ["vehicle", vehicleId] });
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      qc.invalidateQueries({ queryKey: ["dueVehicles"] });
    },
    onError: () => toast.show(t("errors.saveFailed")),
  });
}

export function useDeleteSoftwareUpdate(vehicleId: string) {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (id: string) => api.deleteSoftwareUpdate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["softwareUpdates", vehicleId] });
      qc.invalidateQueries({ queryKey: ["dueVehicles"] });
    },
    onError: () => toast.show(t("errors.saveFailed")),
  });
}
