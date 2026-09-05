import Link from "next/link";
import { AlertTriangle, ArrowRight, Banknote, Boxes, Building2, CalendarClock, CircleDollarSign, ClipboardCheck, Clock3, Gauge, Plus, TimerReset, Wrench } from "lucide-react";
import { BranchField } from "@/components/branch-field";
import { EmptyState } from "@/components/empty-state";
import { MetricStrip } from "@/components/metric-strip";
import { PageHeader } from "@/components/page-header";
import { RecordFeedback } from "@/components/record-feedback";
import { StatusPill } from "@/components/status-pill";
import { getCurrentStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

type PageQuery = { branch?: string };
type PillTone = "blue" | "green" | "amber" | "red" | "gray";

const finishedJobStatuses = ["completed", "cancelled"];
const progressByStatus: Record<string, number> = {
  draft: 3, checked_in: 8, diagnosis: 18, awaiting_approval: 32, approved: 42,
  in_progress: 64, on_hold: 48, qc: 86, ready: 96, delivered: 100, closed: 100, cancelled: 100,
};
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Amman" });
const pageDate = new Intl.DateTimeFormat("en-JO", { timeZone: "Asia/Amman", weekday: "long", day: "numeric", month: "long" });
const appointmentDate = new Intl.DateTimeFormat("en-JO", { timeZone: "Asia/Amman", weekday: "short", day: "numeric", month: "short" });
const clockTime = new Intl.DateTimeFormat("en-JO", { timeZone: "Asia/Amman", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const money = new Intl.NumberFormat("en-JO", { style: "currency", currency: "JOD" });

function statusTone(status: string): PillTone {
  if (["ready", "completed", "paid", "checked_in"].includes(status)) return "green";
  if (["awaiting_approval", "on_hold", "paused", "blocked", "requested"].includes(status)) return "amber";
  if (["quarantine", "emergency_escalation"].includes(status)) return "red";
  if (["cancelled", "no_show"].includes(status)) return "gray";
  return "blue";
}

function dueCopy(promisedAt: string | null, now: Date) {
  if (!promisedAt) return { label: "No promise", urgent: false };
  const minutes = Math.round((new Date(promisedAt).getTime() - now.getTime()) / 60_000);
  if (minutes < 0) return { label: `${Math.max(1, Math.ceil(Math.abs(minutes) / 60))}h overdue`, urgent: true };
  if (minutes < 60) return { label: `${minutes}m remaining`, urgent: true };
  if (minutes < 24 * 60) return { label: `${Math.ceil(minutes / 60)}h remaining`, urgent: minutes < 3 * 60 };
  return { label: `${Math.ceil(minutes / (24 * 60))}d remaining`, urgent: false };
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<PageQuery> }) {
  const query = await searchParams;
  const staff = await getCurrentStaff();
  const supabase = await createClient();
  const { data: branches, error: branchError } = await supabase.from("branches").select("id, code, city, display_name").eq("organization_id", staff.organizationId).eq("status", "active").order("city");
  const selectedBranch = branches?.find((branch) => branch.id === (query.branch ?? staff.selectedBranchId));
  const selectedBranchId = selectedBranch?.id;
  const scopeBranches = selectedBranch ? [selectedBranch] : (branches ?? []);
  const scopeLabel = selectedBranch ? `${selectedBranch.city} · ${selectedBranch.code}` : "All accessible branches";
  const now = new Date();
  const today = dayKey.format(now);
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const todayStart = `${today}T00:00:00+03:00`;

  let orderQuery = supabase.from("repair_orders").select("id, branch_id, ro_number, status, risk_state, opened_at, promised_at, customer:customers(display_name), vehicle:vehicles(registration_no, vin, model:vehicle_models(name)), branch:branches(code, city, display_name)").eq("organization_id", staff.organizationId).not("status", "in", '("delivered","closed","cancelled")').order("promised_at", { ascending: true, nullsFirst: false });
  let jobQuery = supabase.from("jobs").select("id, branch_id, repair_order_id, status, description_snapshot, safety_class, planned_minutes, job_assignments(assignment_kind, unassigned_at), labor_entries(started_at, ended_at)").eq("organization_id", staff.organizationId).not("status", "in", '("completed","cancelled")');
  let appointmentQuery = supabase.from("appointments").select("id, branch_id, start_at, end_at, status, customer:customers(display_name), vehicle:vehicles(registration_no, vin, model:vehicle_models(name)), branch:branches(code, city)").eq("organization_id", staff.organizationId).gte("start_at", todayStart).lte("start_at", weekEnd.toISOString()).not("status", "in", '("cancelled","no_show")').order("start_at");
  let invoiceQuery = supabase.from("invoices").select("id, branch_id, status, grand_total, paid_total, posted_at").eq("organization_id", staff.organizationId).in("status", ["posted", "partially_paid", "paid"]);
  let paymentQuery = supabase.from("payments").select("id, branch_id, amount, status, received_at").eq("organization_id", staff.organizationId).eq("status", "received").gte("received_at", todayStart);
  let balanceQuery = supabase.from("stock_balances").select("id, branch_id, part_id, on_hand, reserved, average_cost, part:parts(part_number, description_en), branch:branches(code, city)").eq("organization_id", staff.organizationId);
  let resourceQuery = supabase.from("resources").select("id, branch_id, resource_type, status").eq("organization_id", staff.organizationId).eq("status", "active").in("resource_type", ["bay", "lift"]);
  if (selectedBranchId) {
    orderQuery = orderQuery.eq("branch_id", selectedBranchId);
    jobQuery = jobQuery.eq("branch_id", selectedBranchId);
    appointmentQuery = appointmentQuery.eq("branch_id", selectedBranchId);
    invoiceQuery = invoiceQuery.eq("branch_id", selectedBranchId);
    paymentQuery = paymentQuery.eq("branch_id", selectedBranchId);
    balanceQuery = balanceQuery.eq("branch_id", selectedBranchId);
    resourceQuery = resourceQuery.eq("branch_id", selectedBranchId);
  }

  const [ordersResult, jobsResult, appointmentsResult, invoicesResult, paymentsResult, balancesResult, resourcesResult, partsResult] = await Promise.all([
    orderQuery, jobQuery, appointmentQuery, invoiceQuery, paymentQuery, balanceQuery, resourceQuery,
    supabase.from("parts").select("id, part_number, description_en").eq("organization_id", staff.organizationId).eq("status", "active").order("part_number"),
  ]);
  const orders = ordersResult.data ?? [];
  const jobs = jobsResult.data ?? [];
  const appointments = appointmentsResult.data ?? [];
  const invoices = invoicesResult.data ?? [];
  const payments = paymentsResult.data ?? [];
  const balances = balancesResult.data ?? [];
  const resources = resourcesResult.data ?? [];
  const parts = partsResult.data ?? [];
  const queryError = [branchError, ordersResult.error, jobsResult.error, appointmentsResult.error, invoicesResult.error, paymentsResult.error, balancesResult.error, resourcesResult.error, partsResult.error].find(Boolean);

  const activeTimers = jobs.reduce((total, job) => total + job.labor_entries.filter((entry) => entry.ended_at === null).length, 0);
  const todayAppointments = appointments.filter((appointment) => dayKey.format(new Date(appointment.start_at)) === today);
  const arrivalsToday = todayAppointments.filter((appointment) => ["confirmed", "checked_in"].includes(appointment.status)).length;
  const receivables = invoices.filter((invoice) => ["posted", "partially_paid"].includes(invoice.status)).reduce((total, invoice) => total + Number(invoice.grand_total) - Number(invoice.paid_total), 0);
  const collectedToday = payments.reduce((total, payment) => total + Number(payment.amount), 0);
  const postedThisMonth = invoices.filter((invoice) => invoice.posted_at && invoice.posted_at >= monthStart).reduce((total, invoice) => total + Number(invoice.grand_total), 0);
  const jobsByOrder = new Map<string, typeof jobs>();
  for (const job of jobs) jobsByOrder.set(job.repair_order_id, [...(jobsByOrder.get(job.repair_order_id) ?? []), job]);
  const overdueOrders = orders.filter((order) => order.promised_at && new Date(order.promised_at) < now);
  const riskOrders = orders.filter((order) => order.risk_state !== "normal");
  const awaitingApproval = orders.filter((order) => order.status === "awaiting_approval");
  const blockedJobs = jobs.filter((job) => job.status === "blocked");
  const unassignedJobs = jobs.filter((job) => !job.job_assignments.some((assignment) => assignment.assignment_kind === "primary" && assignment.unassigned_at === null));
  const availableByPart = new Map<string, number>();
  for (const balance of balances) availableByPart.set(balance.part_id, (availableByPart.get(balance.part_id) ?? 0) + Number(balance.on_hand) - Number(balance.reserved));
  const unavailableParts = parts.filter((part) => (availableByPart.get(part.id) ?? 0) <= 0);
  const exceptions = [
    riskOrders.length ? { icon: AlertTriangle, title: `${riskOrders.length} safety-restricted work order${riskOrders.length === 1 ? "" : "s"}`, copy: "Quarantine or restricted handling requires workshop attention.", href: "/work-orders", tone: "red" } : null,
    overdueOrders.length ? { icon: Clock3, title: `${overdueOrders.length} promised handover${overdueOrders.length === 1 ? " is" : "s are"} overdue`, copy: "Review the workshop sequence and update the customer.", href: "/work-orders", tone: "amber" } : null,
    awaitingApproval.length ? { icon: ClipboardCheck, title: `${awaitingApproval.length} order${awaitingApproval.length === 1 ? "" : "s"} awaiting approval`, copy: "Customer approval is holding the repair path.", href: "/estimates", tone: "amber" } : null,
    blockedJobs.length || unassignedJobs.length ? { icon: Wrench, title: `${blockedJobs.length} blocked · ${unassignedJobs.length} unassigned`, copy: "Workshop jobs need recovery or dispatch.", href: "/work-orders", tone: "amber" } : null,
    unavailableParts.length ? { icon: Boxes, title: `${unavailableParts.length} catalog part${unavailableParts.length === 1 ? "" : "s"} unavailable`, copy: "No free stock exists in the selected scope.", href: "/inventory", tone: "amber" } : null,
  ].filter((exception): exception is NonNullable<typeof exception> => Boolean(exception));

  const branchRows = scopeBranches.map((branch) => {
    const branchOrders = orders.filter((order) => order.branch_id === branch.id);
    const branchJobs = jobs.filter((job) => job.branch_id === branch.id);
    const activeJobs = branchJobs.filter((job) => !finishedJobStatuses.includes(job.status)).length;
    const bays = resources.filter((resource) => resource.branch_id === branch.id).length;
    const saturation = bays ? Math.min(100, Math.round(activeJobs / bays * 100)) : null;
    const branchReceivables = invoices.filter((invoice) => invoice.branch_id === branch.id && ["posted", "partially_paid"].includes(invoice.status)).reduce((total, invoice) => total + Number(invoice.grand_total) - Number(invoice.paid_total), 0);
    return { ...branch, orders: branchOrders.length, activeJobs, bays, saturation, receivables: branchReceivables, today: todayAppointments.filter((appointment) => appointment.branch_id === branch.id).length };
  });

  if (!branches?.length) return <>
    <PageHeader eyebrow={pageDate.format(now)} title="Service control room" description="Live workshop flow, branch capacity and commercial exceptions across the network.">{staff.role === "admin" ? <Link className="button primary" href="/branches?new=1#new-branch"><Plus /> Create first branch</Link> : null}</PageHeader>
    <RecordFeedback error={branchError ? "The branch network could not be loaded." : undefined} />
    <EmptyState icon={Building2} title="Your control room starts with a branch" description={staff.role === "admin" ? "Create the first city service center. Its stockroom, document sequences and operating access become the foundation for every dashboard signal." : "An administrator must create a service branch and assign you access before operational data can appear."} action={staff.role === "admin" ? <Link className="button primary" href="/branches?new=1#new-branch">Set up first branch</Link> : undefined} />
  </>;

  return <>
    <PageHeader eyebrow={pageDate.format(now)} title="Service control room" description={`Live workshop, customer and commercial signals · ${scopeLabel}`}>
      <Link className="button" href="/appointments?new=1#new-appointment"><CalendarClock /> Book visit</Link>
      <Link className="button primary" href="/work-orders?new=1#new-work-order"><Plus /> Open work order</Link>
    </PageHeader>
    <RecordFeedback error={queryError ? "Some dashboard signals could not be loaded. Refresh or check your branch access." : undefined} />
    <section className="dashboard-scope" aria-label="Dashboard branch scope">
      <div className="dashboard-scope-copy"><span className="live-dot" /><div><strong>Live operational scope</strong><small>RLS-limited to branches assigned to your account</small></div></div>
      <form className="scope-form" action="/dashboard"><BranchField id="dashboard-branch" name="branch" label="Branch" branches={branches} selectedBranchId={staff.selectedBranchId} value={selectedBranchId} placeholder="All accessible branches" /><button className="button compact" type="submit">Apply scope</button></form>
    </section>
    <MetricStrip metrics={[
      { label: "Active work orders", value: String(orders.length), note: `${overdueOrders.length} overdue promise${overdueOrders.length === 1 ? "" : "s"}`, noteTone: overdueOrders.length ? "warn" : "good", icon: Wrench },
      { label: "Running timers", value: String(activeTimers), note: `${jobs.length} open workshop jobs`, noteTone: activeTimers ? "good" : undefined, icon: TimerReset },
      { label: "Arrivals today", value: String(arrivalsToday), note: `${todayAppointments.length} scheduled today`, icon: CalendarClock },
      { label: "Open receivables", value: money.format(receivables), note: `${money.format(collectedToday)} collected today`, noteTone: receivables ? "warn" : "good", icon: CircleDollarSign },
    ]} />

    <div className="dashboard-grid">
      <section className="panel workshop-pulse">
        <div className="panel-header"><div><div className="panel-title">Workshop pulse</div><div className="panel-subtitle">Priority work ordered by promised handover</div></div><Link className="panel-link" href="/work-orders">Open workshop ledger →</Link></div>
        {orders.length ? <div className="pulse-list">{orders.slice(0, 8).map((order) => {
          const orderJobs = jobsByOrder.get(order.id) ?? [];
          const progress = progressByStatus[order.status] ?? 0;
          const due = dueCopy(order.promised_at, now);
          return <article className={`pulse-row ${order.risk_state !== "normal" ? "has-risk" : ""}`} key={order.id}>
            <div className="pulse-order"><span className="mono">{order.ro_number}</span><StatusPill label={order.status} tone={statusTone(order.status)} /></div>
            <div className="pulse-vehicle"><strong>{order.vehicle?.model?.name ?? "Volkswagen ID"} · {order.vehicle?.registration_no ?? order.vehicle?.vin}</strong><span>{order.customer?.display_name ?? "Unknown customer"} · {order.branch?.city}</span></div>
            <div className="pulse-progress"><div><span>{orderJobs.length ? `${orderJobs.length} open job${orderJobs.length === 1 ? "" : "s"}` : "Order stage"}</span><strong className="mono">{progress}%</strong></div><div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div></div>
            <div className={`pulse-due ${due.urgent ? "urgent" : ""}`}><Clock3 /><div><span>Promised</span><strong>{due.label}</strong></div></div>
          </article>;
        })}</div> : <div className="panel-empty"><Gauge /><strong>No active workshop flow</strong><span>Open a work order when the next vehicle checks in.</span><Link className="panel-link" href="/work-orders?new=1#new-work-order">Open first work order →</Link></div>}
      </section>
      <aside className="stack">
        <section className="panel action-panel"><div className="panel-header"><div><div className="panel-title">Action required</div><div className="panel-subtitle">Live exceptions, highest impact first</div></div><span className={`exception-count ${exceptions.length ? "active" : ""}`}>{exceptions.length}</span></div>
          {exceptions.length ? <div className="panel-body alert-list">{exceptions.slice(0, 5).map((exception) => { const Icon = exception.icon; return <Link className={`alert-item alert-${exception.tone}`} href={exception.href} key={exception.title}><div className="alert-icon"><Icon /></div><div><strong>{exception.title}</strong><span>{exception.copy}</span></div><ArrowRight className="alert-arrow" /></Link>; })}</div> : <div className="all-clear"><ClipboardCheck /><div><strong>Control room clear</strong><span>No active safety, timing, dispatch or stock exceptions.</span></div></div>}
        </section>
        <section className="panel finance-glance"><div className="panel-header"><div><div className="panel-title">Commercial glance</div><div className="panel-subtitle">Posted activity in the selected scope</div></div><Banknote /></div><div className="finance-number mono">{money.format(postedThisMonth)}</div><div className="finance-label">Gross posted this month</div><div className="finance-split"><span>Collected today<strong className="mono">{money.format(collectedToday)}</strong></span><span>Still due<strong className="mono">{money.format(receivables)}</strong></span></div><Link className="finance-link" href="/invoices">Open billing control <ArrowRight /></Link></section>
      </aside>
    </div>

    <section className="panel branch-board"><div className="panel-header"><div><div className="panel-title">Branch operating board</div><div className="panel-subtitle">Comparable workload, capacity and cash exposure by city</div></div><Link className="panel-link" href="/branches">Manage network →</Link></div><div className="data-scroll"><table className="data-table branch-dashboard-table"><thead><tr><th>Branch</th><th>Active orders</th><th>Open jobs</th><th>Today</th><th>Bay / lift load</th><th className="align-right">Receivables</th></tr></thead><tbody>{branchRows.map((branch) => <tr key={branch.id}><td><div className="cell-main">{branch.display_name}</div><div className="cell-sub mono">{branch.city} · {branch.code}</div></td><td className="mono">{branch.orders}</td><td className="mono">{branch.activeJobs}</td><td className="mono">{branch.today} visits</td><td><div className="capacity-copy"><span>{branch.bays ? `${branch.activeJobs} jobs / ${branch.bays} resources` : "Capacity not configured"}</span>{branch.saturation !== null ? <strong className="mono">{branch.saturation}%</strong> : null}</div><div className="util-track"><div className={`util-fill ${(branch.saturation ?? 0) > 85 ? "hot" : ""}`} style={{ width: `${branch.saturation ?? 0}%` }} /></div></td><td className="align-right cell-main mono">{money.format(branch.receivables)}</td></tr>)}</tbody></table></div></section>

    <div className="dashboard-lower-grid">
      <section className="panel"><div className="panel-header"><div><div className="panel-title">Next arrivals</div><div className="panel-subtitle">Upcoming seven-day reception queue</div></div><Link className="panel-link" href="/appointments">Full schedule →</Link></div>{appointments.length ? <div className="arrival-list">{appointments.slice(0, 6).map((appointment) => <article className="arrival-row" key={appointment.id}><div className="arrival-time"><strong>{clockTime.format(new Date(appointment.start_at))}</strong><span>{appointmentDate.format(new Date(appointment.start_at))}</span></div><div className="arrival-identity"><strong>{appointment.vehicle?.model?.name ?? "Volkswagen ID"} · {appointment.vehicle?.registration_no ?? appointment.vehicle?.vin}</strong><span>{appointment.customer?.display_name ?? "Unknown customer"} · {appointment.branch?.city}</span></div><StatusPill label={appointment.status} tone={statusTone(appointment.status)} /></article>)}</div> : <div className="panel-empty compact-empty"><CalendarClock /><strong>No arrivals in the next seven days</strong><Link className="panel-link" href="/appointments?new=1#new-appointment">Book a visit →</Link></div>}</section>
      <section className="panel"><div className="panel-header"><div><div className="panel-title">Parts availability</div><div className="panel-subtitle">Catalog items with no free stock in scope</div></div><Link className="panel-link" href="/inventory">Open inventory →</Link></div>{unavailableParts.length ? <div className="parts-exception-list">{unavailableParts.slice(0, 6).map((part) => <article key={part.id}><div><strong className="mono">{part.part_number}</strong><span>{part.description_en}</span></div><StatusPill label="unavailable" tone="amber" /></article>)}</div> : <div className="panel-empty compact-empty"><Boxes /><strong>{parts.length ? "All catalog parts have free stock" : "No parts catalog yet"}</strong><Link className="panel-link" href="/inventory?new=part#new-part">{parts.length ? "Review balances" : "Add first part"} →</Link></div>}</section>
    </div>
  </>;
}
