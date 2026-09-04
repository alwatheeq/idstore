import type { SupabaseClient } from "@supabase/supabase-js";

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
};

export async function createRepairOrder(client: SupabaseClient, input: CreateRepairOrderInput) {
  const { data, error } = await client.rpc("create_repair_order", {
    p_organization_id: input.organizationId,
    p_branch_id: input.branchId,
    p_customer_id: input.customerId,
    p_vehicle_id: input.vehicleId,
    p_appointment_id: input.appointmentId ?? null,
    p_odometer_km: input.odometerKm ?? null,
    p_state_of_charge: input.stateOfCharge ?? null,
    p_customer_concern: input.customerConcern ?? null,
    p_promised_at: input.promisedAt ?? null,
  });
  if (error) throw error;
  return data;
}

export async function transitionRepairOrder(
  client: SupabaseClient,
  repairOrderId: string,
  expectedVersion: number,
  nextStatus: string,
  reason?: string,
) {
  const { data, error } = await client.rpc("transition_repair_order", {
    p_repair_order_id: repairOrderId,
    p_expected_version: expectedVersion,
    p_to_status: nextStatus,
    p_reason: reason ?? null,
  });
  if (error) throw error;
  return data;
}

export async function receiveInvoicePayment(
  client: SupabaseClient,
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
    p_provider_ref: input.providerReference ?? null,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw error;
  return data;
}
