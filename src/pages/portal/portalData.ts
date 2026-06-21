import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Vehicle } from "@/features/customers/types";
import type { ServiceOrder } from "@/features/orders/types";

export function useMyVehicles() {
  return useQuery({
    queryKey: ["my-vehicles"],
    queryFn: async (): Promise<Vehicle[]> => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Vehicle[];
    },
  });
}

export function useMyVehicle(id: string | undefined) {
  return useQuery({
    queryKey: ["my-vehicle", id],
    enabled: !!id,
    queryFn: async (): Promise<Vehicle | null> => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return (data as Vehicle) ?? null;
    },
  });
}

export function useVehicleOrders(vehicleId: string | undefined) {
  return useQuery({
    queryKey: ["my-vehicle-orders", vehicleId],
    enabled: !!vehicleId,
    queryFn: async (): Promise<ServiceOrder[]> => {
      const { data, error } = await supabase
        .from("service_orders")
        .select("*")
        .eq("vehicle_id", vehicleId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ServiceOrder[];
    },
  });
}
