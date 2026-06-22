import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";
import { useActiveBranch } from "@/features/branches/ActiveBranchContext";
import type { CustomerPayload, VehiclePayload } from "./schema";

export function useCustomers(search = "") {
  const { branchId } = useActiveBranch();
  return useQuery({
    queryKey: ["customers", branchId, search],
    queryFn: () => api.listCustomers(search, branchId),
  });
}

export function useCustomer(id: string | undefined) {
  return useQuery({ queryKey: ["customer", id], queryFn: () => api.getCustomer(id!), enabled: !!id });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  const { branchId } = useActiveBranch();
  return useMutation({
    mutationFn: (payload: CustomerPayload) => api.createCustomer(payload, branchId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}

export function useUpdateCustomer(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CustomerPayload) => api.updateCustomer(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customer", id] });
    },
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteCustomer(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customer", id] });
    },
  });
}

export function useVehicles(customerId: string | undefined) {
  return useQuery({
    queryKey: ["vehicles", customerId],
    queryFn: () => api.listVehicles(customerId!),
    enabled: !!customerId,
  });
}

export function useVehicle(id: string | undefined) {
  return useQuery({ queryKey: ["vehicle", id], queryFn: () => api.getVehicle(id!), enabled: !!id });
}

export function useCreateVehicle(customerId: string, branchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: VehiclePayload) => api.createVehicle(customerId, payload, branchId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vehicles", customerId] }),
  });
}

export function useUpdateVehicle(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: VehiclePayload }) => api.updateVehicle(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vehicles", customerId] }),
  });
}

export function useDeleteVehicle(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteVehicle(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vehicles", customerId] }),
  });
}
