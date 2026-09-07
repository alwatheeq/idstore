import Link from "next/link";
import { Building2, MapPin, MessageCircle, Pencil, Phone, Plus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { RecordFeedback } from "@/components/record-feedback";
import { StatusPill } from "@/components/status-pill";
import { getCurrentStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createBranch, updateBranchContacts } from "./actions";

type PageQuery = { new?: string; edit?: string; created?: string; error?: string };

function branchAddress(value: unknown) {
  if (!value || Array.isArray(value) || typeof value !== "object") return "";
  const line = (value as Record<string, unknown>).line1;
  return typeof line === "string" ? line : "";
}

export default async function BranchesPage({ searchParams }: { searchParams: Promise<PageQuery> }) {
  const query = await searchParams;
  const staff = await getCurrentStaff();
  const supabase = await createClient();
  const [{ data: branches, error: branchError }, { data: activeOrders }] = await Promise.all([
    supabase
      .from("branches")
      .select("id, code, legal_name, display_name, city, address_json, phone, whatsapp, email, status, warehouses(name)")
      .eq("organization_id", staff.organizationId)
      .order("city"),
    supabase
      .from("repair_orders")
      .select("branch_id")
      .eq("organization_id", staff.organizationId)
      .not("status", "in", '("delivered","closed","cancelled")'),
  ]);

  const orderCounts = new Map<string, number>();
  for (const order of activeOrders ?? []) orderCounts.set(order.branch_id, (orderCounts.get(order.branch_id) ?? 0) + 1);
  const showForm = staff.role === "admin" && (query.new === "1" || (Boolean(query.error) && !query.edit));
  const selectedBranch = staff.role === "admin" ? branches?.find((branch) => branch.id === query.edit) : undefined;

  return <>
    <PageHeader eyebrow="Network administration" title="Branches" description="Configure cities, warehouses, service capabilities, invoice sequences, hours and branch access.">
      {staff.role === "admin" ? <Link className="button primary" href="/branches?new=1#new-branch"><Plus /> Add branch</Link> : null}
    </PageHeader>
    <RecordFeedback created={query.created} error={query.error ?? (branchError ? "Branch records could not be loaded." : undefined)} />

    {showForm ? <section className="panel operation-form" id="new-branch">
      <div className="panel-header"><div><div className="panel-title">Open a service branch</div><div className="panel-subtitle">Creates the branch and its main warehouse in one transaction.</div></div><Link className="panel-link" href="/branches">Cancel</Link></div>
      <form action={createBranch} className="form-grid panel-body">
        <div className="form-field"><label htmlFor="branch-code">Branch code</label><input id="branch-code" name="code" placeholder="AMM-01" pattern="[A-Za-z0-9][A-Za-z0-9-]{1,15}" required /></div>
        <div className="form-field"><label htmlFor="branch-city">City</label><input id="branch-city" name="city" placeholder="Amman" required /></div>
        <div className="form-field"><label htmlFor="branch-display-name">Display name</label><input id="branch-display-name" name="displayName" placeholder="Amman Service Hub" required /></div>
        <div className="form-field"><label htmlFor="branch-legal-name">Legal name</label><input id="branch-legal-name" name="legalName" placeholder="IDstore Amman Service Center" required /></div>
        <div className="form-field form-span-2"><label htmlFor="branch-address">Street address</label><input id="branch-address" name="addressLine1" autoComplete="street-address" required /></div>
        <div className="form-field"><label htmlFor="branch-phone">Branch phone</label><input id="branch-phone" name="phone" type="tel" autoComplete="tel" placeholder="+962 6 000 0000" pattern="[+0-9][+0-9 ()-]{6,23}" required /></div>
        <div className="form-field"><label htmlFor="branch-whatsapp">WhatsApp number</label><input id="branch-whatsapp" name="whatsapp" type="tel" autoComplete="tel" placeholder="+962 79 000 0000" pattern="[+0-9][+0-9 ()-]{6,23}" required /></div>
        <div className="form-field"><label htmlFor="branch-email">Branch email</label><input id="branch-email" name="email" type="email" autoComplete="email" /></div>
        <div className="form-field"><label htmlFor="branch-tax">Tax registration</label><input id="branch-tax" name="taxRegistration" /></div>
        <div className="form-actions form-span-2"><Link className="button" href="/branches">Cancel</Link><button className="button primary" type="submit">Create branch</button></div>
      </form>
    </section> : null}

    {selectedBranch ? <section className="panel operation-form" id="branch-contacts">
      <div className="panel-header"><div><div className="panel-title">Branch contacts · {selectedBranch.display_name}</div><div className="panel-subtitle">Keep the public address, voice line and WhatsApp channel specific to this branch.</div></div><Link className="panel-link" href="/branches">Close</Link></div>
      <form action={updateBranchContacts} className="form-grid panel-body">
        <input name="branchId" type="hidden" value={selectedBranch.id} />
        <div className="form-field form-span-2"><label htmlFor="contact-address">Street address</label><input id="contact-address" name="addressLine1" autoComplete="street-address" defaultValue={branchAddress(selectedBranch.address_json)} required /></div>
        <div className="form-field"><label htmlFor="contact-phone">Branch phone</label><input id="contact-phone" name="phone" type="tel" autoComplete="tel" defaultValue={selectedBranch.phone ?? ""} pattern="[+0-9][+0-9 ()-]{6,23}" required /></div>
        <div className="form-field"><label htmlFor="contact-whatsapp">WhatsApp number</label><input id="contact-whatsapp" name="whatsapp" type="tel" autoComplete="tel" defaultValue={selectedBranch.whatsapp ?? ""} pattern="[+0-9][+0-9 ()-]{6,23}" required /></div>
        <div className="form-field form-span-2"><label htmlFor="contact-email">Branch email</label><input id="contact-email" name="email" type="email" autoComplete="email" defaultValue={selectedBranch.email ?? ""} /></div>
        <div className="form-actions form-span-2"><Link className="button" href="/branches">Cancel</Link><button className="button primary" type="submit">Save</button></div>
      </form>
    </section> : null}

    {!branches?.length ? <EmptyState icon={Building2} title="No branches yet" description="Create the first service center before adding customers, vehicles or work orders." action={staff.role === "admin" ? <Link className="button primary" href="/branches?new=1#new-branch">Create first branch</Link> : undefined} /> : <>
      <div className="cards-grid">{branches.map((branch, index) => {
        return <article className={`branch-card ${index === 0 ? "selected" : ""}`} key={branch.id}><div className="branch-card-head"><div><div className="branch-code">{branch.code}</div><h3>{branch.display_name}</h3><p>{branch.city}, Jordan</p></div><StatusPill label="General service" tone="gray" /></div><div className="branch-contact-list"><span><MapPin /> {branchAddress(branch.address_json) || "Address required"}</span><span><Phone /> {branch.phone || "Phone required"}</span><span><MessageCircle /> {branch.whatsapp || "WhatsApp required"}</span></div><div className="branch-stats"><div><span>Active jobs</span><strong className="mono">{orderCounts.get(branch.id) ?? 0}</strong></div><div><span>Status</span><strong style={{ fontSize: 14 }}>{branch.status}</strong></div></div>{staff.role === "admin" ? <Link className="branch-edit-link" href={`/branches?edit=${branch.id}#branch-contacts`}><Pencil /> Contacts</Link> : null}</article>;
      })}</div>
      <section className="panel" style={{ marginTop: 20 }}><div className="panel-header"><div><div className="panel-title">Network configuration</div><div className="panel-subtitle">Live branch contacts and warehouse readiness</div></div></div><div className="data-scroll"><table className="data-table branch-directory"><thead><tr><th>Branch</th><th>Address</th><th>Warehouse</th><th>Phone</th><th>WhatsApp</th><th>Status</th></tr></thead><tbody>{branches.map((branch) => {
        return <tr key={branch.id}><td><div className="cell-main">{branch.display_name}</div><div className="cell-sub">{branch.code} · {branch.legal_name}</div></td><td>{branchAddress(branch.address_json) || "Required"}</td><td>{branch.warehouses[0]?.name ?? "Not configured"}</td><td className="mono">{branch.phone ?? "Required"}</td><td className="mono">{branch.whatsapp ?? "Required"}</td><td><StatusPill label={branch.status} tone={branch.status === "active" ? "green" : "gray"} /></td></tr>;
      })}</tbody></table></div></section>
    </>}
  </>;
}
