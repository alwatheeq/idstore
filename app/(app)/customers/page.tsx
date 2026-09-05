import Link from "next/link";
import { AlertTriangle, KeyRound, MapPin, Plus, ShieldCheck, Users } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { MetricStrip } from "@/components/metric-strip";
import { PageHeader } from "@/components/page-header";
import { RecordFeedback } from "@/components/record-feedback";
import { SearchFilters } from "@/components/search-filters";
import { getCurrentStaff } from "@/lib/auth/session";
import { callingCodes } from "@/lib/auth/mobile";
import { createClient } from "@/lib/supabase/server";
import { addCustomerAddress, addCustomerContact, createCustomer, provisionCustomerPortal, recordCustomerConsent, transitionCustomerStatus } from "./actions";

type PageQuery = { new?: string; portal?: string; manage?: string; created?: string; error?: string };

const money = new Intl.NumberFormat("en-JO", { style: "currency", currency: "JOD" });
const date = new Intl.DateTimeFormat("en-JO", { day: "numeric", month: "short", year: "numeric" });

export default async function CustomersPage({ searchParams }: { searchParams: Promise<PageQuery> }) {
  const query = await searchParams;
  const staff = await getCurrentStaff();
  const supabase = await createClient();
  const [{ data: branches }, { data: customers, error }] = await Promise.all([
    supabase.from("branches").select("id, code, city, display_name").eq("organization_id", staff.organizationId).eq("status", "active").order("city"),
    supabase
      .from("customers")
      .select("id, display_name, customer_type, tax_number, status, created_at, preferred_branch:branches(display_name, city), customer_contacts(kind, value, normalized_value, is_primary), customer_addresses(id, address_type, country_code, admin_area, city, address_line1, address_line2, postal_code, is_primary), consents(purpose, channel, state, policy_version, source, recorded_at), vehicle_ownerships(vehicle_id), invoices(grand_total, created_at), customer_accounts(status)")
      .eq("organization_id", staff.organizationId)
      .order("created_at", { ascending: false }),
  ]);

  const activeCustomers = (customers ?? []).filter((customer) => customer.status === "active");
  const fleets = activeCustomers.filter((customer) => customer.customer_type === "company");
  const vehicleCount = activeCustomers.reduce((total, customer) => total + customer.vehicle_ownerships.length, 0);
  const contactComplete = activeCustomers.filter((customer) => customer.customer_contacts.some((contact) => contact.kind === "mobile" || contact.kind === "phone")).length;
  const duplicateKeys = new Map<string, string[]>();
  for (const customer of customers ?? []) {
    for (const contact of customer.customer_contacts) {
      const key = `contact:${contact.normalized_value}`;
      duplicateKeys.set(key, [...(duplicateKeys.get(key) ?? []), customer.display_name]);
    }
    if (customer.tax_number) {
      const key = `tax:${customer.tax_number.toLowerCase()}`;
      duplicateKeys.set(key, [...(duplicateKeys.get(key) ?? []), customer.display_name]);
    }
  }
  const duplicateGroups = [...duplicateKeys.entries()].filter(([, names]) => new Set(names).size > 1);
  const showForm = query.new === "1" || Boolean(query.error);

  return <>
    <PageHeader eyebrow="Customer management" title="Customers" description="A single customer record across branches, vehicles, consent history, visits, estimates and invoices.">
      {branches?.length ? <Link className="button primary" href="/customers?new=1#new-customer"><Plus /> Add customer</Link> : <Link className="button primary" href="/branches?new=1#new-branch"><Plus /> Create a branch first</Link>}
    </PageHeader>
    <RecordFeedback created={query.created} error={query.error ?? (error ? "Customer records could not be loaded." : undefined)} />

    {showForm && branches?.length ? <section className="panel operation-form" id="new-customer">
      <div className="panel-header"><div><div className="panel-title">Add a customer</div><div className="panel-subtitle">Create the shared customer record and primary contact details.</div></div><Link className="panel-link" href="/customers">Cancel</Link></div>
      <form action={createCustomer} className="form-grid panel-body">
        <div className="form-field"><label htmlFor="customer-branch">Preferred branch</label><select id="customer-branch" name="branchId" defaultValue={staff.selectedBranchId ?? ""} required><option value="">Select branch</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.city} · {branch.code}</option>)}</select></div>
        <div className="form-field"><label htmlFor="customer-type">Customer type</label><select id="customer-type" name="customerType" defaultValue="individual"><option value="individual">Individual</option><option value="company">Company / fleet</option></select></div>
        <div className="form-field form-span-2"><label htmlFor="customer-name">Customer or company name</label><input id="customer-name" name="displayName" autoComplete="name" required /></div>
        <div className="form-field"><label htmlFor="customer-mobile">Mobile number</label><div className="phone-control"><select name="dialCode" defaultValue="+962" aria-label="Country and calling code">{callingCodes.map((country) => <option key={country.iso} value={country.dialCode}>{country.iso} {country.dialCode}</option>)}</select><input id="customer-mobile" name="mobile" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="79 000 0000" /></div></div>
        <div className="form-field"><label htmlFor="customer-email">Email</label><input id="customer-email" name="email" type="email" autoComplete="email" /></div>
        <div className="form-field"><label htmlFor="customer-city">City</label><input id="customer-city" name="city" autoComplete="address-level2" /></div>
        <div className="form-field"><label htmlFor="customer-tax">Tax number</label><input id="customer-tax" name="taxNumber" /></div>
        <div className="form-field form-span-2"><label htmlFor="customer-address">Billing address</label><input id="customer-address" name="addressLine1" autoComplete="street-address" /></div>
        <div className="form-field form-span-2"><label htmlFor="customer-notes">Service notes</label><textarea id="customer-notes" name="notes" rows={3} /></div>
        <div className="form-actions form-span-2"><Link className="button" href="/customers">Cancel</Link><button className="button primary" type="submit">Create customer</button></div>
      </form>
    </section> : null}

    {staff.role === "admin" && query.portal ? <section className="panel operation-form" id="portal-access"><div className="panel-header"><div><div className="panel-title">Create customer portal access</div><div className="panel-subtitle">Customer identity remains separate from Admin and Staff access.</div></div><Link className="panel-link" href="/customers">Cancel</Link></div><form action={provisionCustomerPortal} className="form-grid panel-body"><input type="hidden" name="customerId" value={query.portal} /><div className="form-field form-span-2"><label>Customer</label><input value={customers?.find((item) => item.id === query.portal)?.display_name ?? "Selected customer"} readOnly /></div><div className="form-field"><label htmlFor="portal-mobile">Mobile login</label><div className="phone-control"><select name="dialCode" defaultValue="+962" aria-label="Country and calling code">{callingCodes.map((country) => <option key={country.iso} value={country.dialCode}>{country.iso} {country.dialCode}</option>)}</select><input id="portal-mobile" name="mobile" type="tel" inputMode="tel" required /></div></div><div className="form-field"><label htmlFor="portal-pin">Six-digit PIN</label><input className="mono" id="portal-pin" name="pin" type="password" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} autoComplete="new-password" required /></div><div className="form-actions form-span-2"><button className="button primary" type="submit"><KeyRound /> Create portal login</button></div></form></section> : null}

    {query.manage ? (() => {
      const customer = customers?.find((item) => item.id === query.manage);
      if (!customer) return null;
      return <section className="panel operation-form" id="customer-controls">
        <div className="panel-header"><div><div className="panel-title">Customer controls · {customer.display_name}</div><div className="panel-subtitle">Contacts, addresses, consent and privacy status retain an auditable history.</div></div><Link className="panel-link" href="/customers">Close</Link></div>
        <div className="customer-control-grid">
          <form action={addCustomerContact} className="form-grid panel-body"><input type="hidden" name="customerId" value={customer.id}/><div className="form-field"><label htmlFor="contact-kind">Contact type</label><select id="contact-kind" name="kind" defaultValue="mobile"><option value="mobile">Mobile</option><option value="phone">Phone</option><option value="whatsapp">WhatsApp</option><option value="email">Email</option></select></div><div className="form-field"><label htmlFor="contact-value">Contact value</label><div className="phone-control"><select name="dialCode" defaultValue="+962" aria-label="Country and calling code">{callingCodes.map(country=><option key={country.iso} value={country.dialCode}>{country.iso} {country.dialCode}</option>)}</select><input id="contact-value" name="value" required/></div></div><label className="check-field form-span-2"><input type="checkbox" name="isPrimary" defaultChecked/><span>Set as primary for this contact type</span></label><div className="form-actions form-span-2"><button className="button primary" type="submit">Add contact</button></div></form>
          <form action={addCustomerAddress} className="form-grid panel-body"><input type="hidden" name="customerId" value={customer.id}/><div className="form-field"><label htmlFor="address-type">Address type</label><select id="address-type" name="addressType" defaultValue="service"><option value="billing">Billing</option><option value="service">Service / pickup</option><option value="home">Home</option><option value="work">Work</option></select></div><div className="form-field"><label htmlFor="address-country">Country code</label><input className="mono" id="address-country" name="countryCode" defaultValue="JO" minLength={2} maxLength={2} required/></div><div className="form-field"><label htmlFor="address-area">Governorate / area</label><input id="address-area" name="adminArea"/></div><div className="form-field"><label htmlFor="address-city">City</label><input id="address-city" name="city" required/></div><div className="form-field form-span-2"><label htmlFor="address-line1">Address line</label><input id="address-line1" name="addressLine1" required/></div><div className="form-field"><label htmlFor="address-line2">Additional directions</label><input id="address-line2" name="addressLine2"/></div><div className="form-field"><label htmlFor="address-postal">Postal code</label><input id="address-postal" name="postalCode"/></div><label className="check-field form-span-2"><input type="checkbox" name="isPrimary" defaultChecked/><span>Primary address for this type</span></label><div className="form-actions form-span-2"><button className="button primary" type="submit"><MapPin/> Add address</button></div></form>
          <form action={recordCustomerConsent} className="form-grid panel-body"><input type="hidden" name="customerId" value={customer.id}/><div className="form-field"><label htmlFor="consent-purpose">Purpose</label><input id="consent-purpose" name="purpose" placeholder="service_updates / marketing" required/></div><div className="form-field"><label htmlFor="consent-channel">Channel</label><select id="consent-channel" name="channel" defaultValue="sms"><option value="sms">SMS</option><option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="phone">Phone</option><option value="push">Push</option></select></div><div className="form-field"><label htmlFor="consent-state">Decision</label><select id="consent-state" name="state" defaultValue="granted"><option value="granted">Granted</option><option value="withdrawn">Withdrawn</option></select></div><div className="form-field"><label htmlFor="consent-policy">Policy version</label><input className="mono" id="consent-policy" name="policyVersion" placeholder="PRIVACY-1" required/></div><div className="form-field form-span-2"><label htmlFor="consent-source">Evidence source</label><input id="consent-source" name="source" placeholder="Signed form / portal / recorded call reference" required/></div><div className="form-actions form-span-2"><button className="button dark" type="submit">Record consent decision</button></div></form>
          <form action={transitionCustomerStatus} className="form-grid panel-body"><input type="hidden" name="customerId" value={customer.id}/><div className="form-field"><label htmlFor="customer-status">Privacy / account status</label><select id="customer-status" name="status" defaultValue={customer.status === "anonymized" ? "archived" : customer.status}><option value="active">Active</option><option value="restricted">Restricted / privacy hold</option><option value="archived">Archived</option></select></div><div className="form-field"><label htmlFor="status-reason">Audit reason</label><input id="status-reason" name="reason" placeholder="Customer request / duplicate review…" required/></div><div className="form-actions form-span-2"><button className="button dark" type="submit"><ShieldCheck/> Update status</button></div></form>
        </div>
        {customer.customer_addresses.length ? <div className="consent-ledger">{customer.customer_addresses.map(address=><article key={address.id}><div><strong>{address.address_type} · {address.city}</strong><span>{address.address_line1}{address.address_line2 ? ` · ${address.address_line2}` : ""}</span></div><span>{address.is_primary ? "Primary" : address.country_code}</span></article>)}</div> : null}
        <div className="consent-ledger">{customer.consents.map(consent=><article key={`${consent.purpose}:${consent.channel}:${consent.recorded_at}`}><div><strong>{consent.purpose} · {consent.channel}</strong><span>{consent.policy_version} · {consent.source}</span></div><span>{consent.state} · {date.format(new Date(consent.recorded_at))}</span></article>)}</div>
      </section>;
    })() : null}

    {duplicateGroups.length ? <section className="panel"><div className="panel-header"><div><div className="panel-title"><AlertTriangle size={17}/> Duplicate identity review</div><div className="panel-subtitle">Shared contact or tax identifiers need staff review before another customer is created.</div></div><span className="status-pill amber">{duplicateGroups.length} match{duplicateGroups.length === 1 ? "" : "es"}</span></div><div className="consent-ledger">{duplicateGroups.map(([key, names])=><article key={key}><div><strong>{key.startsWith("tax:") ? "Tax number" : "Contact"} match</strong><span>{[...new Set(names)].join(" · ")}</span></div><span>Review</span></article>)}</div></section> : null}

    <MetricStrip metrics={[
      { label: "Active customers", value: String(activeCustomers.length), note: "Live customer records", icon: Users },
      { label: "Fleet accounts", value: String(fleets.length), note: "Company customers", icon: Users },
      { label: "Registered vehicles", value: String(vehicleCount), note: "Current ownership links", icon: Users },
      { label: "Mobile complete", value: activeCustomers.length ? `${Math.round(contactComplete / activeCustomers.length * 100)}%` : "—", note: "Primary service contact", noteTone: contactComplete === activeCustomers.length && activeCustomers.length ? "good" : "warn", icon: Users },
    ]} />

    {!customers?.length ? <EmptyState icon={Users} title="No customers yet" description={branches?.length ? "Add the first customer to start a vehicle and service history." : "Create a branch first, then add customers for that location."} action={branches?.length ? <Link className="button primary" href="/customers?new=1#new-customer">Add first customer</Link> : <Link className="button" href="/branches?new=1#new-branch">Set up branches</Link>} /> : <section className="panel"><div className="panel-body"><SearchFilters placeholder="Search name, mobile or account…" filters={["All cities", "All customer types"]} /></div><div className="data-scroll"><table className="data-table"><thead><tr><th>Customer</th><th>Contact</th><th>City</th><th>Vehicles</th><th>Portal</th><th>Since</th><th className="align-right">Lifetime value</th></tr></thead><tbody>{customers.map((customer) => {
      const contact = customer.customer_contacts.find((item) => item.is_primary && (item.kind === "mobile" || item.kind === "phone")) ?? customer.customer_contacts[0];
      const city = customer.customer_addresses.find((address) => address.is_primary)?.city ?? customer.preferred_branch?.city;
      const lifetimeValue = customer.invoices.reduce((total, invoice) => total + Number(invoice.grand_total), 0);
      return <tr key={customer.id}><td><div className="cell-main"><Link href={`/customers?manage=${customer.id}#customer-controls`}>{customer.display_name}</Link></div><div className="cell-sub">{customer.customer_type === "company" ? "Fleet account" : "Individual"} · {customer.status}</div></td><td className="mono">{contact?.value ?? "—"}</td><td>{city ?? "—"}</td><td className="mono">{customer.vehicle_ownerships.length}</td><td>{customer.customer_accounts.some((account) => account.status === "active") ? "Active" : staff.role === "admin" ? <Link className="button compact" href={`/customers?portal=${customer.id}#portal-access`}>Enable</Link> : "Not enabled"}</td><td>{date.format(new Date(customer.created_at))}</td><td className="align-right cell-main mono">{money.format(lifetimeValue)}</td></tr>;
    })}</tbody></table></div></section>}
  </>;
}
