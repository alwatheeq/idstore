import type { Vehicle } from "@/features/customers/types";

export interface SoftwareUpdate {
  id: string;
  branch_id: string;
  vehicle_id: string;
  service_order_id: string | null;
  from_version: string | null;
  to_version: string;
  applied_at: string; // date (YYYY-MM-DD)
  notes: string | null;
  created_at: string;
}

/** A vehicle joined with its owner's name, for the "updates due" worklist. */
export interface DueVehicle extends Vehicle {
  customers: { name: string } | null;
}
