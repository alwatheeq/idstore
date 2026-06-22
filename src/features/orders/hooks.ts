import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";
import { nextStatus } from "./status";
import type { OrderStatus, InspectionMedia } from "./types";
import type { Concern } from "./concerns";
import type { IntakePayload, LinePayload } from "./schema";

export function useOrders(status?: OrderStatus) {
  return useQuery({ queryKey: ["orders", status ?? "all"], queryFn: () => api.listOrders(status) });
}
export function useOrder(id: string | undefined) {
  return useQuery({ queryKey: ["order", id], queryFn: () => api.getOrder(id!), enabled: !!id });
}
export function useLastOdometer(vehicleId: string | undefined) {
  return useQuery({
    queryKey: ["lastOdometer", vehicleId],
    queryFn: () => api.getLastOdometer(vehicleId!),
    enabled: !!vehicleId,
  });
}
export function useOrdersByVehicle(vehicleId: string | undefined) {
  return useQuery({
    queryKey: ["orders-by-vehicle", vehicleId],
    queryFn: () => api.listOrdersByVehicle(vehicleId!),
    enabled: !!vehicleId,
  });
}
export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: IntakePayload) => api.createOrder(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });
}
export function useAdvanceStatus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (current: OrderStatus) => {
      const n = nextStatus(current);
      if (!n) throw new Error("Cannot advance this status");
      return api.updateOrderStatus(id, n);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order", id] });
    },
  });
}
export function useUpdateConcerns(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (concerns: Concern[]) => api.updateOrderConcerns(id, concerns),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["order", id] }),
  });
}
export function useApproveOrder(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (approvedBy: string) => api.approveOrder(id, approvedBy),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order", id] });
    },
  });
}
export function useLines(orderId: string | undefined) {
  return useQuery({ queryKey: ["lines", orderId], queryFn: () => api.listLines(orderId!), enabled: !!orderId });
}
export function useCreateLine(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: LinePayload) => api.createLine(orderId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lines", orderId] }),
  });
}
export function useUpdateLine(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: LinePayload }) => api.updateLine(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lines", orderId] }),
  });
}
export function useDeleteLine(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteLine(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lines", orderId] }),
  });
}
export function useMedia(orderId: string | undefined) {
  return useQuery({ queryKey: ["media", orderId], queryFn: () => api.listMedia(orderId!), enabled: !!orderId });
}
export function useUploadMedia(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => api.uploadMedia(orderId, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["media", orderId] }),
  });
}
export function useDeleteMedia(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (m: InspectionMedia) => api.deleteMedia(m),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["media", orderId] }),
  });
}
