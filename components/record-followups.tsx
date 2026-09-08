import { createClient } from "@/lib/supabase/server";
import { workshopToday } from "@/lib/followups";
import { FollowupList, type Followup } from "@/components/followup-list";

/** RLS and organization scoping apply before record/ownership filtering. */
export async function RecordFollowups({ organizationId, customerId, vehicleId, canEdit = false }: { organizationId: string; customerId?: string; vehicleId?: string; canEdit?: boolean }) {
  const supabase = await createClient(); const today = workshopToday();
  const failed = <FollowupList items={[]} today={today} error />;
  let vehicleIds: string[] | undefined;
  if (customerId) {
    const { data, error } = await supabase.from("vehicle_ownerships").select("vehicle_id").eq("organization_id", organizationId).eq("customer_id", customerId).lte("valid_from", today).or(`valid_to.is.null,valid_to.gte.${today}`);
    if (error) return failed;
    vehicleIds = [...new Set((data ?? []).map(row => row.vehicle_id))];
    if (!vehicleIds.length) return <FollowupList items={[]} today={today} />;
  }
  // Page through all open items rather than silently losing reminders at the API row limit.
  const items: Followup[] = [];
  for (let from = 0; ; from += 500) {
    let query = supabase.from("vehicle_recommendations").select("id, vehicle_id, description, severity, due_date, updated_at, vehicle:vehicles(registration_no, vin, model:vehicle_models(name), vehicle_ownerships(customer_id, valid_from, valid_to, customer:customers(id, display_name, customer_contacts(kind, value, normalized_value, is_primary))))").eq("organization_id", organizationId).in("status", ["open", "scheduled"]).order("id").range(from, from + 499);
    if (vehicleId) query = query.eq("vehicle_id", vehicleId);
    if (vehicleIds) query = query.in("vehicle_id", vehicleIds);
    const { data, error } = await query;
    if (error) return failed;
    for (const row of data ?? []) {
      const contacts = new Map<string, Followup["contacts"][number]>();
      for (const ownership of row.vehicle?.vehicle_ownerships ?? []) {
        const customer = ownership.customer;
        if (!customer || ownership.valid_from > today || (ownership.valid_to && ownership.valid_to < today) || (customerId && customer.id !== customerId)) continue;
        const phones = customer.customer_contacts.filter(c => ["mobile", "phone", "whatsapp"].includes(c.kind));
        const phone = phones.find(p => p.is_primary) ?? phones[0];
        contacts.set(customer.id, { id: customer.id, name: customer.display_name, phone: phone ? (phone.normalized_value || phone.value).replace(/[^+0-9]/g, "") : null });
      }
      items.push({ id: row.id, vehicle_id: row.vehicle_id, description: row.description, severity: row.severity, due_date: row.due_date, updated_at: row.updated_at, vehicleLabel: [row.vehicle?.model?.name, row.vehicle?.registration_no ?? row.vehicle?.vin].filter(Boolean).join(" · "), contacts: [...contacts.values()] });
    }
    if (!data || data.length < 500) break;
  }
  return <FollowupList items={items} today={today} canEdit={canEdit} />;
}
