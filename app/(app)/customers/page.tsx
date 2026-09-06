import Link from "next/link";
import { CustomerServiceHistory } from "@/components/customer-service-history";
import { AlertTriangle, CarFront, KeyRound, MapPin, Plus, ShieldCheck, Users } from "lucide-react";
import { BranchField } from "@/components/branch-field";
import { EmptyState } from "@/components/empty-state";
import { MetricStrip } from "@/components/metric-strip";
import { PageHeader } from "@/components/page-header";
import { RecordFeedback } from "@/components/record-feedback";
import { RecordFilters } from "@/components/record-filters";
import { matchesRecordSearch } from "@/lib/record-search";
import { CustomerVehicles } from "@/components/customer-vehicles";
import { RecordDocuments } from "@/components/record-documents";
import { StatusPill } from "@/components/status-pill";
import { getCurrentStaff } from "@/lib/auth/session";
import { callingCodes } from "@/lib/auth/mobile";
import { createClient } from "@/lib/supabase/server";
import { addCustomerAddress, addCustomerContact, createCustomer, provisionCustomerPortal, recordCustomerConsent, transitionCustomerStatus } from "./actions";

type PageQuery = { q?: string; filter?: string; duplicate?: string; new?: string; portal?: string; manage?: string; tab?: string; created?: string; error?: string };

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
      .select("id, display_name, customer_type, tax_number, status, created_at, preferred_branch:branches(display_name, city), customer_contacts(kind, value, normalized_value, is_primary), customer_addresses(id, address_type, country_code, admin_area, city, address_line1, address_line2, postal_code, is_primary), consents(purpose, channel, state, policy_version, source, recorded_at), vehicle_ownerships(id, relationship, valid_from, valid_to, verified_at, vehicle:vehicles(id, registration_no, vin, model:vehicle_models(name))), invoices(grand_total, created_at), customer_accounts(status)")
      .eq("organization_id", staff.organizationId)
      .order("created_at", { ascending: false }),
  ]);

  const visibleCustomers = (customers ?? []).filter(customer =>
    (!query.filter || customer.customer_type === query.filter) && matchesRecordSearch(query.q, [
      customer.display_name, customer.tax_number, customer.preferred_branch?.city,
      ...customer.customer_contacts.flatMap(c => [c.value, c.normalized_value]),
      ...customer.customer_addresses.map(a => a.city),
    ]));
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
  const showForm = query.new === "1" || Boolean(query.error && !query.manage && !query.duplicate);
  const duplicateIds = new Set(query.duplicate?.split(",") ?? []);

  return <>
    <PageHeader eyebrow="Customer management" title="Customers" description="A single customer record across branches, vehicles, consent history, visits, estimates and invoices.">
      {branches?.length ? <Link className="button primary" href="/customers?new=1#new-customer"><Plus /> Add customer</Link> : <Link className="button primary" href="/branches?new=1#new-branch"><Plus /> Create a branch first</Link>}
    </PageHeader>
    <RecordFeedback created={query.created} error={query.error ?? (error ? "Customer records could not be loaded." : undefined)} />

    {duplicateIds.size ? <section className="panel panel-body" id="duplicate-customers"><h2>Existing customers</h2><div className="journey-actions">{customers?.filter(customer => duplicateIds.has(customer.id)).map(customer => <Link className="button" key={customer.id} href={`/customers?manage=${customer.id}#customer-controls`}>{customer.display_name}</Link>)}</div></section> : null}

    {showForm && branches?.length ? <section className="panel operation-form" id="new-customer">
      <div className="panel-header"><div><div className="panel-title">Add a customer</div><div className="panel-subtitle">Create the shared customer record and primary contact details.</div></div><Link className="panel-link" href="/customers">Cancel</Link></div>
      <form action={createCustomer} className="form-grid panel-body">
        <BranchField id="customer-branch" label="Preferred branch" branches={branches} selectedBranchId={staff.selectedBranchId} value={branches.length === 1 ? branches[0].id : undefined} />
        <div className="form-field form-span-2"><label htmlFor="customer-name">Customer or company name</label><input id="customer-name" name="displayName" autoComplete="name" required /></div>
        <div className="form-field"><label htmlFor="customer-mobile">Mobile number</label><div className="phone-control"><select name="dialCode" defaultValue="+962" aria-label="Country and calling code">{callingCodes.map((country) => <option key={country.iso} value={country.dialCode}>{country.iso} {country.dialCode}</option>)}</select><input id="customer-mobile" name="mobile" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="79 000 0000" required /></div></div>
        <details className="journey-details form-span-2"><summary>Additional details (optional)</summary><div className="form-grid">
        <div className="form-field"><label htmlFor="customer-type">Customer type</label><select id="customer-type" name="customerType" defaultValue="individual"><option value="individual">Individual</option><option value="company">Company / fleet</option></select></div>
        <div className="form-field"><label htmlFor="customer-pin">6-digit PIN (for portal login, optional)</label><input className="mono" id="customer-pin" name="portalPin" type="password" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} autoComplete="new-password" /></div>
        <div className="form-field"><label htmlFor="customer-email">Email</label><input id="customer-email" name="email" type="email" autoComplete="email" /></div>
        <div className="form-field"><label htmlFor="customer-city">City</label><input id="customer-city" name="city" autoComplete="address-level2" /></div>
        <div className="form-field"><label htmlFor="customer-tax">Tax number</label><input id="customer-tax" name="taxNumber" /></div>
        <div className="form-field form-span-2"><label htmlFor="customer-address">Billing address</label><input id="customer-address" name="addressLine1" autoComplete="street-address" /></div>
        <div className="form-field form-span-2"><label htmlFor="customer-notes">Service notes</label><textarea id="customer-notes" name="notes" rows={3} /></div>
        </div></details>
        <div className="form-actions form-span-2"><Link className="button" href="/customers">Cancel</Link><button className="button primary" type="submit">Create customer</button></div>
      </form>
    </section> : null}

    {query.portal ? <section className="panel operation-form" id="portal-access"><div className="panel-header"><div><div className="panel-title">Create customer portal access</div><div className="panel-subtitle">Customer identity remains separate from Admin and Staff access.</div></div><Link className="panel-link" href="/customers">Cancel</Link></div><form action={provisionCustomerPortal} className="form-grid panel-body"><input type="hidden" name="customerId" value={query.portal} /><div className="form-field form-span-2"><label>Customer</label><input value={customers?.find((item) => item.id === query.portal)?.display_name ?? "Selected customer"} readOnly /></div><div className="form-field"><label htmlFor="portal-mobile">Mobile login</label><div className="phone-control"><select name="dialCode" defaultValue="+962" aria-label="Country and calling code">{callingCodes.map((country) => <option key={country.iso} value={country.dialCode}>{country.iso} {country.dialCode}</option>)}</select><input id="portal-mobile" name="mobile" type="tel" inputMode="tel" required /></div></div><div className="form-field"><label htmlFor="portal-pin">Six-digit PIN</label><input className="mono" id="portal-pin" name="pin" type="password" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} autoComplete="new-password" required /></div><div className="form-actions form-span-2"><button className="button primary" type="submit"><KeyRound /> Create portal login</button></div></form></section> : null}

    {query.manage ? (() => {
      const customer = customers?.find((item) => item.id === query.manage);
      if (!customer) return null;
      const primaryContact = customer.customer_contacts.find((contact) => contact.is_primary) ?? customer.customer_contacts[0];
      const primaryAddress = customer.customer_addresses.find((address) => address.is_primary) ?? customer.customer_addresses[0];
      const portalEnabled = customer.customer_accounts.some((account) => account.status === "active");
      const customerTab = query.tab === "vehicles" || query.tab === "documents" || query.tab === "quotes" || query.tab === "invoices" || query.tab === "service" || query.tab === "history" || query.tab === "access" ? query.tab : "overview";
      return <section className="panel operation-form customer-workspace" id="customer-controls">
        <div className="customer-workspace-header">
          <div className="customer-identity"><div className="customer-avatar" aria-hidden="true">{customer.display_name.slice(0, 2).toUpperCase()}</div><div><div className="eyebrow">Customer record</div><div className="customer-workspace-title">{customer.display_name}</div><div className="customer-workspace-meta"><span>{customer.customer_type === "company" ? "Fleet account" : "Individual"}</span><span aria-hidden="true"> · </span><span>{customer.status}</span></div></div></div>
          <div className="customer-workspace-actions"><StatusPill label={customer.status} tone={customer.status === "active" ? "green" : "amber"} /><Link className="panel-link" href="/customers">Close</Link></div>
        </div>
        <div className="journey-actions panel-body"><Link className="button" href={`/vehicles?new=1&customer=${customer.id}#new-vehicle`}>Add vehicle</Link><Link className="button primary" href={`/work-orders?new=1&customer=${customer.id}#new-work-order`}>New visit</Link></div>
        <nav className="customer-tabs" aria-label="Customer sections">
          <Link className={`customer-tab ${customerTab === "overview" ? "active" : ""}`} aria-current={customerTab === "overview" ? "page" : undefined} href={`/customers?manage=${customer.id}&tab=overview#customer-controls`}>Overview</Link>
          <Link className={`customer-tab ${customerTab === "service" ? "active" : ""}`} aria-current={customerTab === "service" ? "page" : undefined} href={`/customers?manage=${customer.id}&tab=service#customer-controls`}>Service history</Link>
          <Link className={`customer-tab ${customerTab === "history" ? "active" : ""}`} aria-current={customerTab === "history" ? "page" : undefined} href={`/customers?manage=${customer.id}&tab=history#customer-controls`}>Contact history</Link>
          <Link className={`customer-tab ${customerTab === "access" ? "active" : ""}`} aria-current={customerTab === "access" ? "page" : undefined} href={`/customers?manage=${customer.id}&tab=access#customer-controls`}>Privacy & access</Link>
          {[{ id: "vehicles", label: "Vehicles" }, { id: "quotes", label: "Quotations" }, { id: "invoices", label: "Invoices & payments" }, { id: "documents", label: "Documents" }].map(tab => <Link key={tab.id} className={`customer-tab ${customerTab === tab.id ? "active" : ""}`} aria-current={customerTab === tab.id ? "page" : undefined} href={`/customers?manage=${customer.id}&tab=${tab.id}#customer-controls`}>{tab.label}</Link>)}
        </nav>
        <div className="customer-workspace-layout">
          <aside className="customer-profile-rail">
            <div className="customer-rail-heading"><span>Profile snapshot</span><small>Shared across every branch</small></div>
            <dl className="customer-facts">
              <div><dt>Primary contact</dt><dd className="mono">{primaryContact?.value ?? "Not recorded"}</dd></div>
              <div><dt>Primary address</dt><dd>{primaryAddress ? `${primaryAddress.city} · ${primaryAddress.address_line1}` : "Not recorded"}</dd></div>
              <div><dt>Portal access</dt><dd><StatusPill label={portalEnabled ? "Active" : "Not enabled"} tone={portalEnabled ? "green" : "gray"} /></dd></div>
              <div><dt>Lifetime value</dt><dd className="mono">{money.format(customer.invoices.reduce((total, invoice) => total + Number(invoice.grand_total), 0))}</dd></div>
            </dl>
            <div className="customer-rail-heading customer-rail-heading-spaced"><span>Linked vehicles</span><strong>{customer.vehicle_ownerships.length}</strong></div>
            <div className="customer-vehicle-list">
              {customer.vehicle_ownerships.length ? customer.vehicle_ownerships.map((ownership) => {
                const plateOrVin = ownership.vehicle?.registration_no ?? ownership.vehicle?.vin;
                return <article key={ownership.id}><div className="customer-vehicle-icon"><CarFront aria-hidden="true" /></div><div className="customer-vehicle-copy"><div className="customer-vehicle-primary"><strong>{ownership.vehicle ? <Link href={`/vehicles?manage=${ownership.vehicle.id}#vehicle-controls`}>{ownership.vehicle.model?.name ?? "VW ID"}</Link> : "VW ID"}</strong><span className="mono">{plateOrVin ?? "No plate / VIN"}</span></div><div className="customer-vehicle-secondary"><small>{ownership.relationship === "owner" ? "Owner" : ownership.relationship ?? "Owner"}</small>{ownership.verified_at ? <StatusPill label="verified" tone="green" /> : null}</div></div></article>;
              }) : <p className="customer-rail-empty">No linked vehicles</p>}
            </div>
          </aside>
          {customerTab === "vehicles" ? <div className="customer-controls"><CustomerVehicles organizationId={staff.organizationId} customerId={customer.id}/></div> : null}
          {customerTab === "documents" ? <div className="customer-controls"><RecordDocuments organizationId={staff.organizationId} scope={{ type: "customer", id: customer.id }}/></div> : null}
          {customerTab === "quotes" || customerTab === "invoices" ? <div className="customer-controls"><CustomerServiceHistory organizationId={staff.organizationId} customerId={customer.id} view={customerTab}/></div> : null}
          {customerTab === "service" ? <div className="customer-controls"><CustomerServiceHistory organizationId={staff.organizationId} customerId={customer.id} /></div> : null}
          {customerTab === "overview" ? <div className="customer-controls">
            <div className="customer-section-intro"><div><div className="customer-section-kicker">Identity & contact</div><p>Keep the customer’s contact channels and service address current.</p></div></div>
            <div className="customer-control-grid">
              <form action={addCustomerContact} className="form-grid customer-control-card"><input type="hidden" name="customerId" value={customer.id}/><div className="customer-control-card-head"><div className="customer-control-icon"><Users aria-hidden="true" /></div><div><strong>Contact details</strong><span>Add a phone, WhatsApp or email channel.</span></div></div><div className="form-field form-span-2"><label htmlFor="contact-kind">Contact type</label><select id="contact-kind" name="kind" defaultValue="mobile"><option value="mobile">Mobile</option><option value="phone">Phone</option><option value="whatsapp">WhatsApp</option><option value="email">Email</option></select></div><div className="form-field form-span-2"><label htmlFor="contact-value">Contact value</label><div className="phone-control"><select name="dialCode" defaultValue="+962" aria-label="Country and calling code">{callingCodes.map(country=><option key={country.iso} value={country.dialCode}>{country.iso} {country.dialCode}</option>)}</select><input id="contact-value" name="value" required/></div></div><label className="check-field form-span-2"><input type="checkbox" name="isPrimary" defaultChecked/><span>Set as primary for this contact type</span></label><div className="form-actions form-span-2"><button className="button primary" type="submit">Add contact</button></div></form>
              <form action={addCustomerAddress} className="form-grid customer-control-card"><input type="hidden" name="customerId" value={customer.id}/><div className="customer-control-card-head"><div className="customer-control-icon"><MapPin aria-hidden="true" /></div><div><strong>Service address</strong><span>Record where the vehicle is collected or returned.</span></div></div><div className="form-field"><label htmlFor="address-type">Address type</label><select id="address-type" name="addressType" defaultValue="service"><option value="billing">Billing</option><option value="service">Service / pickup</option><option value="home">Home</option><option value="work">Work</option></select></div><div className="form-field"><label htmlFor="address-country">Country code</label><input className="mono" id="address-country" name="countryCode" defaultValue="JO" minLength={2} maxLength={2} required/></div><div className="form-field"><label htmlFor="address-area">Governorate / area</label><input id="address-area" name="adminArea"/></div><div className="form-field"><label htmlFor="address-city">City</label><input id="address-city" name="city" required/></div><div className="form-field form-span-2"><label htmlFor="address-line1">Address line</label><input id="address-line1" name="addressLine1" required/></div><div className="form-field"><label htmlFor="address-line2">Additional directions</label><input id="address-line2" name="addressLine2"/></div><div className="form-field"><label htmlFor="address-postal">Postal code</label><input id="address-postal" name="postalCode"/></div><label className="check-field form-span-2"><input type="checkbox" name="isPrimary" defaultChecked/><span>Primary address for this type</span></label><div className="form-actions form-span-2"><button className="button primary" type="submit"><MapPin/> Add address</button></div></form>
            </div>
          </div> : null}
          {customerTab === "access" ? <div className="customer-controls">
            <div className="customer-section-intro"><div><div className="customer-section-kicker">Privacy & access</div><p>Capture permission evidence and account state without losing the audit trail.</p></div></div>
            <div className="customer-control-grid customer-control-grid-compact">
              <form action={recordCustomerConsent} className="form-grid customer-control-card"><input type="hidden" name="customerId" value={customer.id}/><div className="customer-control-card-head"><div className="customer-control-icon"><ShieldCheck aria-hidden="true" /></div><div><strong>Communication consent</strong><span>Record the customer’s decision for one channel.</span></div></div><div className="form-field"><label htmlFor="consent-purpose">Purpose</label><input id="consent-purpose" name="purpose" placeholder="service_updates / marketing" required/></div><div className="form-field"><label htmlFor="consent-channel">Channel</label><select id="consent-channel" name="channel" defaultValue="sms"><option value="sms">SMS</option><option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="phone">Phone</option><option value="push">Push</option></select></div><div className="form-field"><label htmlFor="consent-state">Decision</label><select id="consent-state" name="state" defaultValue="granted"><option value="granted">Granted</option><option value="withdrawn">Withdrawn</option></select></div><div className="form-field"><label htmlFor="consent-policy">Policy version</label><input className="mono" id="consent-policy" name="policyVersion" placeholder="PRIVACY-1" required/></div><div className="form-field form-span-2"><label htmlFor="consent-source">Evidence source</label><input id="consent-source" name="source" placeholder="Signed form / portal / recorded call reference" required/></div><div className="form-actions form-span-2"><button className="button dark" type="submit">Save consent</button></div></form>
              <form action={transitionCustomerStatus} className="form-grid customer-control-card"><input type="hidden" name="customerId" value={customer.id}/><div className="customer-control-card-head"><div className="customer-control-icon"><KeyRound aria-hidden="true" /></div><div><strong>Account status</strong><span>Restrict or archive the record with a reason.</span></div></div><div className="form-field"><label htmlFor="customer-status">Privacy / account status</label><select id="customer-status" name="status" defaultValue={customer.status === "anonymized" ? "archived" : customer.status}><option value="active">Active</option><option value="restricted">Restricted / privacy hold</option><option value="archived">Archived</option></select></div><div className="form-field"><label htmlFor="status-reason">Audit reason</label><input id="status-reason" name="reason" placeholder="Customer request / duplicate review…" required/></div><div className="form-actions form-span-2"><button className="button dark" type="submit"><ShieldCheck/> Update status</button></div></form>
            </div>
          </div> : null}
        </div>
        {customerTab === "history" ? <div className="customer-ledger-grid">
          <section className="customer-ledger"><div className="customer-ledger-header"><div><strong>Addresses</strong><span>Recorded service and billing locations</span></div><span>{customer.customer_addresses.length}</span></div>{customer.customer_addresses.length ? <div className="consent-ledger">{customer.customer_addresses.map(address=><article key={address.id}><div><strong>{address.address_type} · {address.city}</strong><span>{address.address_line1}{address.address_line2 ? ` · ${address.address_line2}` : ""}</span></div><span>{address.is_primary ? "Primary" : address.country_code}</span></article>)}</div> : <p className="customer-ledger-empty">No addresses recorded</p>}</section>
          <section className="customer-ledger"><div className="customer-ledger-header"><div><strong>Consent history</strong><span>Immutable decisions and evidence sources</span></div><span>{customer.consents.length}</span></div>{customer.consents.length ? <div className="consent-ledger">{customer.consents.map(consent=><article key={`${consent.purpose}:${consent.channel}:${consent.recorded_at}`}><div><strong>{consent.purpose} · {consent.channel}</strong><span>{consent.policy_version} · {consent.source}</span></div><span>{consent.state} · {date.format(new Date(consent.recorded_at))}</span></article>)}</div> : <p className="customer-ledger-empty">No consent decisions recorded</p>}</section>
        </div> : null}
      </section>;
    })() : null}

    {duplicateGroups.length ? <section className="panel"><div className="panel-header"><div><div className="panel-title"><AlertTriangle size={17}/> Duplicate identity review</div><div className="panel-subtitle">Shared contact or tax identifiers need staff review before another customer is created.</div></div><span className="status-pill amber">{duplicateGroups.length} match{duplicateGroups.length === 1 ? "" : "es"}</span></div><div className="consent-ledger">{duplicateGroups.map(([key, names])=><article key={key}><div><strong>{key.startsWith("tax:") ? "Tax number" : "Contact"} match</strong><span>{[...new Set(names)].join(" · ")}</span></div><span>Review</span></article>)}</div></section> : null}

    <MetricStrip metrics={[
      { label: "Active customers", value: String(activeCustomers.length), note: "Live customer records", icon: Users },
      { label: "Fleet accounts", value: String(fleets.length), note: "Company customers", icon: Users },
      { label: "Registered vehicles", value: String(vehicleCount), note: "Current ownership links", icon: Users },
      { label: "Mobile complete", value: activeCustomers.length ? `${Math.round(contactComplete / activeCustomers.length * 100)}%` : "—", note: "Primary service contact", noteTone: contactComplete === activeCustomers.length && activeCustomers.length ? "good" : "warn", icon: Users },
    ]} />

    {!customers?.length ? <EmptyState icon={Users} title="No customers yet" description={branches?.length ? "Add the first customer to start a vehicle and service history." : "Create a branch first, then add customers for that location."} action={branches?.length ? <Link className="button primary" href="/customers?new=1#new-customer">Add first customer</Link> : <Link className="button" href="/branches?new=1#new-branch">Set up branches</Link>} /> : <section className="panel"><div className="panel-body"><RecordFilters action="/customers" query={query.q} facet={query.filter} label="Customer type" placeholder="Search name, mobile or account…" options={[{ value: "individual", label: "Individual" }, { value: "company", label: "Company / fleet" }]}/>{customers.length >= 1000 ? <p className="field-help">Search covers the first 1,000 loaded records.</p> : null}{!visibleCustomers.length ? <p role="status">No matching records.</p> : null}</div><div className="data-scroll"><table className="data-table"><thead><tr><th>Customer</th><th>Contact</th><th>City</th><th>Vehicles</th><th>Portal</th><th>Since</th><th className="align-right">Lifetime value</th></tr></thead><tbody>{visibleCustomers.map((customer) => {
      const contact = customer.customer_contacts.find((item) => item.is_primary && (item.kind === "mobile" || item.kind === "phone")) ?? customer.customer_contacts[0];
      const city = customer.customer_addresses.find((address) => address.is_primary)?.city ?? customer.preferred_branch?.city;
      const lifetimeValue = customer.invoices.reduce((total, invoice) => total + Number(invoice.grand_total), 0);
      return <tr key={customer.id}><td><div className="cell-main"><Link href={`/customers?manage=${customer.id}#customer-controls`}>{customer.display_name}</Link></div><div className="cell-sub">{customer.customer_type === "company" ? "Fleet account" : "Individual"} · {customer.status}</div></td><td className="mono">{contact?.value ?? "—"}</td><td>{city ?? "—"}</td><td>{customer.vehicle_ownerships.length ? customer.vehicle_ownerships.map((ownership) => <div className="cell-sub" key={ownership.id}>{ownership.vehicle?.model?.name ?? "VW ID"} · {ownership.vehicle?.registration_no ?? ownership.vehicle?.vin ?? "No plate / VIN"}</div>) : "—"}</td><td>{customer.customer_accounts.some((account) => account.status === "active") ? "Active" : <Link className="button compact" href={`/customers?portal=${customer.id}#portal-access`}>Enable</Link>}</td><td>{date.format(new Date(customer.created_at))}</td><td className="align-right cell-main mono">{money.format(lifetimeValue)}</td></tr>;
    })}</tbody></table></div></section>}
  </>;
}
