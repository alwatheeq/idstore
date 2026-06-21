import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";
import type { CustomerPayload, VehiclePayload } from "./schema";

export function useCustomers(search = "") {
  return useQuery({ queryKey: ["customers", search], queryFn: () => api.listCustomers(search) });
}

export function useCustomer(id: string | undefined) {
  return useQuery({ queryKey: ["customer", id], queryFn: () => api.getCustomer(id!), enabled: !!id });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CustomerPayload) => api.createCustomer(payload),
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

export function useCreateVehicle(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: VehiclePayload) => api.createVehicle(customerId, payload),
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
