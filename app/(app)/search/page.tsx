import { LocalizedContent } from "@/components/localized-content";
import Link from "next/link";
import { Boxes, CarFront, ClipboardList, FileSearch, ReceiptText, Search, ShoppingCart, Users } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { getCurrentStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

type PageQuery = { q?: string };
function cleanQuery(value: string | undefined) { return (value ?? "").trim().slice(0, 80).replace(/[%,()]/g, " ").replace(/\s+/g, " "); }

export default async function SearchPage({ searchParams }: { searchParams: Promise<PageQuery> }) {
  const { q: raw } = await searchParams;
  const q = cleanQuery(raw);
  const staff = await getCurrentStaff();
  const supabase = await createClient();
  const term = `%${q}%`;
  const empty = { data: [] };
  const [customerResult, vehicleVinResult, vehicleRegResult, orderResult, invoiceResult, partNumberResult, partDescriptionResult, purchaseResult, paymentResult] = q ? await Promise.all([
    supabase.from("customers").select("id, display_name, customer_type, status, preferred_branch:branches(code, city)").eq("organization_id", staff.organizationId).ilike("display_name", term).limit(12),
    supabase.from("vehicles").select("id, vin, registration_no, status, model:vehicle_models(name)").eq("organization_id", staff.organizationId).ilike("vin", term).limit(12),
    supabase.from("vehicles").select("id, vin, registration_no, status, model:vehicle_models(name)").eq("organization_id", staff.organizationId).ilike("registration_no", term).limit(12),
    supabase.from("repair_orders").select("id, ro_number, status, branch:branches(code, city), customer:customers(display_name), vehicle:vehicles(registration_no, vin)").eq("organization_id", staff.organizationId).ilike("ro_number", term).limit(12),
    supabase.from("invoices").select("id, invoice_number, status, grand_total, currency, customer:customers(display_name)").eq("organization_id", staff.organizationId).ilike("invoice_number", term).limit(12),
    supabase.from("parts").select("id, part_number, description_en, status").eq("organization_id", staff.organizationId).ilike("part_number", term).limit(12),
    supabase.from("parts").select("id, part_number, description_en, status").eq("organization_id", staff.organizationId).ilike("description_en", term).limit(12),
    supabase.from("purchase_orders").select("id, po_number, status, supplier:suppliers(name), branch:branches(code, city)").eq("organization_id", staff.organizationId).ilike("po_number", term).limit(12),
    supabase.from("payments").select("id, receipt_number, status, amount, currency, method, branch:branches(code, city)").eq("organization_id", staff.organizationId).ilike("receipt_number", term).limit(12),
  ]) : [empty, empty, empty, empty, empty, empty, empty, empty, empty];
  const unique = <T extends { id: string }>(rows: T[]) => Array.from(new Map(rows.map((row) => [row.id, row])).values());
  const { data: contactHits } = q ? await supabase.from("customer_contacts").select("customer_id").eq("organization_id", staff.organizationId).ilike("normalized_value", term).limit(12) : { data: [] };
  const contactIds = unique((contactHits ?? []).map((item) => ({ id: item.customer_id }))).map((item) => item.id);
  const { data: contactCustomers } = contactIds.length ? await supabase.from("customers").select("id, display_name, customer_type, status, preferred_branch:branches(code, city)").in("id", contactIds) : { data: [] };
  const customers = unique([...(customerResult.data ?? []), ...(contactCustomers ?? [])]);
  const vehicles = unique([...(vehicleVinResult.data ?? []), ...(vehicleRegResult.data ?? [])]);
  const parts = unique([...(partNumberResult.data ?? []), ...(partDescriptionResult.data ?? [])]);
  const groups = [
    { title: "Customers", icon: Users, rows: customers, render: (item: typeof customers[number]) => <Link href={`/customers?customer=${item.id}`}><strong>{item.display_name}</strong><span>{item.customer_type} · {item.preferred_branch ? `${item.preferred_branch.city} ${item.preferred_branch.code}` : "No preferred branch"}</span><StatusPill label={item.status} tone={item.status === "active" ? "green" : "amber"} /></Link> },
    { title: "Vehicles", icon: CarFront, rows: vehicles, render: (item: typeof vehicles[number]) => <Link href={`/vehicles?vehicle=${item.id}`}><strong>{item.model?.name ?? "Volkswagen ID"}</strong><span className="mono">{item.registration_no ?? item.vin ?? "Unregistered"}</span><StatusPill label={item.status} tone={item.status === "active" ? "green" : "amber"} /></Link> },
    { title: "Work orders", icon: ClipboardList, rows: orderResult.data ?? [], render: (item: NonNullable<typeof orderResult.data>[number]) => <Link href={`/work-orders?order=${item.id}`}><strong className="mono">{item.ro_number}</strong><span>{item.customer?.display_name} · {item.vehicle?.registration_no ?? item.vehicle?.vin}</span><StatusPill label={item.status} tone={item.status === "closed" ? "green" : "blue"} /></Link> },
    { title: "Invoices", icon: ReceiptText, rows: invoiceResult.data ?? [], render: (item: NonNullable<typeof invoiceResult.data>[number]) => <Link href={`/invoices?invoice=${item.id}`}><strong className="mono">{item.invoice_number ?? "Draft invoice"}</strong><span>{item.customer?.display_name} · {item.grand_total.toFixed(3)} {item.currency}</span><StatusPill label={item.status} tone={item.status === "paid" ? "green" : "amber"} /></Link> },
    { title: "Parts", icon: Boxes, rows: parts, render: (item: typeof parts[number]) => <Link href={`/inventory?part=${item.id}`}><strong className="mono">{item.part_number}</strong><span>{item.description_en}</span><StatusPill label={item.status} tone={item.status === "active" ? "green" : "amber"} /></Link> },
    { title: "Purchase orders", icon: ShoppingCart, rows: purchaseResult.data ?? [], render: (item: NonNullable<typeof purchaseResult.data>[number]) => <Link href={`/purchasing?po=${item.id}`}><strong className="mono">{item.po_number}</strong><span>{item.supplier?.name} · {item.branch?.city}</span><StatusPill label={item.status} tone={item.status === "closed" ? "green" : "blue"} /></Link> },
    { title: "Receipts", icon: ReceiptText, rows: paymentResult.data ?? [], render: (item: NonNullable<typeof paymentResult.data>[number]) => <Link href="/finance-control"><strong className="mono">{item.receipt_number}</strong><span>{item.method} · {item.amount.toFixed(3)} {item.currency} · {item.branch?.city}</span><StatusPill label={item.status} tone={item.status === "received" ? "green" : "amber"} /></Link> },
  ];
  const resultCount = groups.reduce((sum, group) => sum + group.rows.length, 0);

  return <LocalizedContent>{<><PageHeader eyebrow="Organization-wide lookup" title="Find any operational record" description="Search identifiers and names across every branch you are permitted to access." />
    <form className="global-search-hero" action="/search"><Search aria-hidden="true" /><label className="form-field" htmlFor="record-search"><span className="field-label">Search</span><input id="record-search" name="q" defaultValue={q} placeholder="Customer, VIN, registration, RO, invoice, part or PO…" autoFocus /></label><button className="button primary" type="submit">Search</button></form>
    {!q ? <EmptyState icon={FileSearch} title="Start with an identifier or name" description="Results remain tenant- and branch-scoped by database policy." /> : !resultCount ? <EmptyState icon={FileSearch} title={`No results for “${q}”`} description="Try the full identifier or a shorter customer or part name." /> : <div className="search-groups">{groups.filter((group) => group.rows.length).map(({ title, icon: Icon, rows, render }) => <section className="panel" key={title}><div className="panel-header"><div><div className="panel-title"><Icon /> {title}</div><div className="panel-subtitle">{rows.length} matching record{rows.length === 1 ? "" : "s"}</div></div></div><div className="search-results">{rows.map((item) => <div key={item.id}>{render(item as never)}</div>)}</div></section>)}</div>}
  </>}</LocalizedContent>;
}
