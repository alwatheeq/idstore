"use client";

import Link from "next/link";
import { useState } from "react";
import { useUiLocale } from "@/components/ui-locale";

type Customer = { id: string; display_name: string };
export type IntakeVehicle = { id: string; vin: string | null; registration_no: string | null; model: { name: string } | null; customerIds: string[] };

export function IntakeIdentityFields({ customers, vehicles, initialCustomerId = "", initialVehicleId = "" }: {
  customers: Customer[]; vehicles: IntakeVehicle[]; initialCustomerId?: string; initialVehicleId?: string;
}) {
  const { pageText: t } = useUiLocale();
  const [customerId, setCustomerId] = useState(customers.some(c => c.id === initialCustomerId) ? initialCustomerId : "");
  const [vehicleId, setVehicleId] = useState(vehicles.some(v => v.id === initialVehicleId && v.customerIds.includes(initialCustomerId)) ? initialVehicleId : "");
  const options = vehicles.filter(v => v.customerIds.includes(customerId));
  const vehicle = options.find(v => v.id === vehicleId);
  return <>
    <div className="form-field"><label htmlFor="work-customer">{t("Customer")}</label><select id="work-customer" name="customerId" required value={customerId} onChange={event => { setCustomerId(event.target.value); setVehicleId(""); }}><option value="">{t("Select customer")}</option>{customers.map(customer => <option key={customer.id} value={customer.id}>{customer.display_name}</option>)}</select></div>
    <div className="form-field form-span-2"><label htmlFor="work-vehicle">{t("Vehicle")}</label><select id="work-vehicle" name="vehicleId" required value={vehicleId} disabled={!customerId} onChange={event => setVehicleId(event.target.value)}><option value="">{t("Select vehicle")}</option>{options.map(v => <option key={v.id} value={v.id}>{v.model?.name} · {v.registration_no ?? v.vin}</option>)}</select>
      <div className="journey-actions"><Link href="/customers?new=1#new-customer">{t("Add customer")}</Link>{customerId ? <Link href={`/vehicles?new=1&customer=${customerId}#new-vehicle`}>{t("Add vehicle")}</Link> : null}</div>
    </div>
    {vehicle ? <div className="journey-context form-span-2"><Link href={`/customers?manage=${customerId}#customer-controls`}>{customers.find(c => c.id === customerId)?.display_name}</Link><Link href={`/vehicles?manage=${vehicle.id}#vehicle-controls`}>{vehicle.model?.name} · <bdi dir="ltr">{vehicle.registration_no ?? "—"}</bdi></Link><span>VIN <bdi dir="ltr">{vehicle.vin ?? "—"}</bdi></span></div> : null}
  </>;
}
