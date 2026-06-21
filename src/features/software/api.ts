import { supabase } from "@/lib/supabase";
import { getDefaultBranchId } from "@/lib/branch";
import { filterDueVehicles } from "./due";
import type { SoftwareUpdate, DueVehicle } from "./types";
import type { SoftwareUpdatePayload } from "./schema";

export async function listVehicleUpdates(vehicleId: string): Promise<SoftwareUpdate[]> {
  const { data, error } = await supabase
    .from("vehicle_software_updates")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .order("applied_at", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as SoftwareUpdate[];
}

export async function createSoftwareUpdate(
  vehicleId: string,
  payload: SoftwareUpdatePayload,
  setCurrent: boolean,
): Promise<SoftwareUpdate> {
  const branch_id = await getDefaultBranchId();
  const { data, error } = await supabase
    .from("vehicle_software_updates")
    .insert({ ...payload, vehicle_id: vehicleId, branch_id })
    .select()
    .single();
  if (error) throw error;
  // Convenience: bring the vehicle's current version up to what was applied,
  // so reaching the target naturally clears "due".
  if (setCurrent) {
    const { error: vErr } = await supabase
      .from("vehicles")
      .update({ software_version: payload.to_version })
      .eq("id", vehicleId);
    if (vErr) throw vErr;
  }
  return data as SoftwareUpdate;
}

export async function deleteSoftwareUpdate(id: string): Promise<void> {
  const { error } = await supabase.from("vehicle_software_updates").delete().eq("id", id);
  if (error) throw error;
}

export async function listDueVehicles(): Promise<DueVehicle[]> {
  const { data, error } = await supabase
    .from("vehicles")
    .select("*, customers(name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return filterDueVehicles((data ?? []) as unknown as DueVehicle[]);
}
