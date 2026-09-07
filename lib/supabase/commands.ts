import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type CreateRepairOrderInput = {
  organizationId: string;
  branchId: string;
  customerId: string;
  vehicleId: string;
  appointmentId?: string;
  odometerKm?: number;
  stateOfCharge?: number;
  customerConcern?: string;
  promisedAt?: string;
  orderType?: "maintenance" | "bodyshop";
};

export async function createRepairOrder(client: SupabaseClient<Database>, input: CreateRepairOrderInput) {
  const { data, error } = input.orderType ? await client.rpc("create_workshop_order", {
    p_organization_id: input.organizationId, p_branch_id: input.branchId,
    p_customer_id: input.customerId, p_vehicle_id: input.vehicleId, p_order_type: input.orderType,
    p_odometer_km: input.odometerKm, p_state_of_charge: input.stateOfCharge,
    p_customer_concern: input.customerConcern, p_promised_at: input.promisedAt,
  }) : await client.rpc("create_repair_order", {
    p_organization_id: input.organizationId,
    p_branch_id: input.branchId,
    p_customer_id: input.customerId,
    p_vehicle_id: input.vehicleId,
    p_appointment_id: input.appointmentId,
    p_odometer_km: input.odometerKm,
    p_state_of_charge: input.stateOfCharge,
    p_customer_concern: input.customerConcern,
    p_promised_at: input.promisedAt,
  });
  if (error) throw error;
  return data;
}

export async function transitionRepairOrder(
  client: SupabaseClient<Database>,
  repairOrderId: string,
  expectedVersion: number,
  nextStatus: string,
  reason?: string,
) {
  const { data, error } = await client.rpc("transition_repair_order", {
    p_repair_order_id: repairOrderId,
    p_expected_version: expectedVersion,
    p_to_status: nextStatus,
    p_reason: reason,
  });
  if (error) throw error;
  return data;
}

export async function receiveInvoicePayment(
  client: SupabaseClient<Database>,
  input: {
    invoiceId: string;
    amount: number;
    method: "cash" | "card" | "bank_transfer" | "payment_link" | "fleet_account" | "other";
    providerReference?: string;
    idempotencyKey: string;
  },
) {
  const { data, error } = await client.rpc("receive_invoice_payment", {
    p_invoice_id: input.invoiceId,
    p_amount: input.amount,
    p_method: input.method,
    p_provider_ref: input.providerReference ?? "",
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw error;
  return data;
}
