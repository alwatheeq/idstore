import { supabase } from "@/lib/supabase";
import { getDefaultBranchId } from "@/lib/branch";
import type { Customer, Vehicle } from "./types";
import type { CustomerPayload, VehiclePayload } from "./schema";

export async function listCustomers(search = ""): Promise<Customer[]> {
  let q = supabase.from("customers").select("*").order("created_at", { ascending: false });
  if (search.trim()) q = q.ilike("name", `%${search.trim()}%`);
  const { data, error } = await q;
  if (error) throw error;
  return data as Customer[];
}

export async function getCustomer(id: string): Promise<Customer> {
  const { data, error } = await supabase.from("customers").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Customer;
}

export async function createCustomer(payload: CustomerPayload): Promise<Customer> {
  const branch_id = await getDefaultBranchId();
  const { data, error } = await supabase.from("customers").insert({ ...payload, branch_id }).select().single();
  if (error) throw error;
  return data as Customer;
}

export async function updateCustomer(id: string, payload: CustomerPayload): Promise<Customer> {
  const { data, error } = await supabase.from("customers").update(payload).eq("id", id).select().single();
  if (error) throw error;
  return data as Customer;
}

export async function deleteCustomer(id: string): Promise<void> {
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) throw error;
}

export async function listVehicles(customerId: string): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from("vehicles").select("*").eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Vehicle[];
}

export async function getVehicle(id: string): Promise<Vehicle> {
  const { data, error } = await supabase.from("vehicles").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Vehicle;
}

export async function createVehicle(customerId: string, payload: VehiclePayload): Promise<Vehicle> {
  const branch_id = await getDefaultBranchId();
  const { data, error } = await supabase
    .from("vehicles").insert({ ...payload, customer_id: customerId, branch_id }).select().single();
  if (error) throw error;
  return data as Vehicle;
}

export async function updateVehicle(id: string, payload: VehiclePayload): Promise<Vehicle> {
  const { data, error } = await supabase.from("vehicles").update(payload).eq("id", id).select().single();
  if (error) throw error;
  return data as Vehicle;
}

export async function deleteVehicle(id: string): Promise<void> {
  const { error } = await supabase.from("vehicles").delete().eq("id", id);
  if (error) throw error;
}
