import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { MetricStrip } from "@/components/metric-strip";
import { PageHeader } from "@/components/page-header";
import { RecordFeedback } from "@/components/record-feedback";
import { SearchFilters } from "@/components/search-filters";
import { getCurrentStaff } from "@/lib/auth/session";
import { callingCodes } from "@/lib/auth/mobile";
import { createClient } from "@/lib/supabase/server";
import { createCustomer } from "./actions";

type PageQuery = { new?: string; created?: string; error?: string };

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
      .select("id, display_name, customer_type, status, created_at, preferred_branch:branches(display_name, city), customer_contacts(kind, value, is_primary), customer_addresses(city, is_primary), vehicle_ownerships(vehicle_id), invoices(grand_total, created_at)")
      .eq("organization_id", staff.organizationId)
      .order("created_at", { ascending: false }),
  ]);

  const activeCustomers = (customers ?? []).filter((customer) => customer.status === "active");
  const fleets = activeCustomers.filter((customer) => customer.customer_type === "company");
  const vehicleCount = activeCustomers.reduce((total, customer) => total + customer.vehicle_ownerships.length, 0);
  const contactComplete = activeCustomers.filter((customer) => customer.customer_contacts.some((contact) => contact.kind === "mobile" || contact.kind === "phone")).length;
  const showForm = query.new === "1" || Boolean(query.error);

  return <>
    <PageHeader eyebrow="Customer management" title="Customers" description="A single customer record across branches, vehicles, consent history, visits, estimates and invoices.">
      {branches?.length ? <Link className="button primary" href="/customers?new=1#new-customer"><Plus /> Add customer</Link> : <Link className="button primary" href="/branches?new=1#new-branch"><Plus /> Create a branch first</Link>}
    </PageHeader>
    <RecordFeedback created={query.created} error={query.error ?? (error ? "Customer records could not be loaded." : undefined)} />

    {showForm && branches?.length ? <section className="panel operation-form" id="new-customer">
      <div className="panel-header"><div><div className="panel-title">Add a customer</div><div className="panel-subtitle">Create the shared customer record and primary contact details.</div></div><Link className="panel-link" href="/customers">Cancel</Link></div>
      <form action={createCustomer} className="form-grid panel-body">
        <div className="form-field"><label htmlFor="customer-branch">Preferred branch</label><select id="customer-branch" name="branchId" required><option value="">Select branch</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.city} · {branch.code}</option>)}</select></div>
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

    <MetricStrip metrics={[
      { label: "Active customers", value: String(activeCustomers.length), note: "Live customer records", icon: Users },
      { label: "Fleet accounts", value: String(fleets.length), note: "Company customers", icon: Users },
      { label: "Registered vehicles", value: String(vehicleCount), note: "Current ownership links", icon: Users },
      { label: "Mobile complete", value: activeCustomers.length ? `${Math.round(contactComplete / activeCustomers.length * 100)}%` : "—", note: "Primary service contact", noteTone: contactComplete === activeCustomers.length && activeCustomers.length ? "good" : "warn", icon: Users },
    ]} />

    {!customers?.length ? <EmptyState icon={Users} title="No customers yet" description={branches?.length ? "Add the first customer to start a vehicle and service history." : "Create a branch first, then add customers for that location."} action={branches?.length ? <Link className="button primary" href="/customers?new=1#new-customer">Add first customer</Link> : <Link className="button" href="/branches?new=1#new-branch">Set up branches</Link>} /> : <section className="panel"><div className="panel-body"><SearchFilters placeholder="Search name, mobile or account…" filters={["All cities", "All customer types"]} /></div><div className="data-scroll"><table className="data-table"><thead><tr><th>Customer</th><th>Contact</th><th>City</th><th>Vehicles</th><th>Since</th><th className="align-right">Lifetime value</th></tr></thead><tbody>{customers.map((customer) => {
      const contact = customer.customer_contacts.find((item) => item.is_primary && (item.kind === "mobile" || item.kind === "phone")) ?? customer.customer_contacts[0];
      const city = customer.customer_addresses.find((address) => address.is_primary)?.city ?? customer.preferred_branch?.city;
      const lifetimeValue = customer.invoices.reduce((total, invoice) => total + Number(invoice.grand_total), 0);
      return <tr key={customer.id}><td><div className="cell-main">{customer.display_name}</div><div className="cell-sub">{customer.customer_type === "company" ? "Fleet account" : "Individual"} · {customer.status}</div></td><td className="mono">{contact?.value ?? "—"}</td><td>{city ?? "—"}</td><td className="mono">{customer.vehicle_ownerships.length}</td><td>{date.format(new Date(customer.created_at))}</td><td className="align-right cell-main mono">{money.format(lifetimeValue)}</td></tr>;
    })}</tbody></table></div></section>}
  </>;
}
