import { BarChart3, Boxes, CalendarDays, CircleDollarSign, Clock3, ShieldAlert, Wrench } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { MetricStrip } from "@/components/metric-strip";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { getCurrentStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const money = new Intl.NumberFormat("en-JO", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export default async function ReportsPage() {
  const staff = await getCurrentStaff();
  const supabase = await createClient();
  let canOperations = staff.role === "admin";
  let canFinance = staff.role === "admin";
  if (staff.role === "staff") {
    const { data: membership } = await supabase.from("memberships").select("id").eq("organization_id", staff.organizationId).eq("user_id", staff.userId).eq("status", "active").maybeSingle();
    if (membership) {
      const { data: permissions } = await supabase.from("membership_permissions").select("permission_code, allowed").eq("membership_id", membership.id).in("permission_code", ["report.operations.read", "report.finance.read"]);
      canOperations = Boolean(permissions?.some((item) => item.permission_code === "report.operations.read" && item.allowed));
      canFinance = Boolean(permissions?.some((item) => item.permission_code === "report.finance.read" && item.allowed));
    }
  }
  if (!canOperations && !canFinance) return <><PageHeader eyebrow="Permission controlled" title="Branch reports" description="Operational and financial reporting permissions are assigned independently." /><EmptyState icon={ShieldAlert} title="Reporting access is not assigned" description="Ask an administrator for operational or financial report access." /></>;

  const [{ data: branches }, { data: orders }, { data: appointments }, { data: balances }, { data: recommendations }, { data: invoices }, { data: payments }, { data: refunds }, { data: jobs }, { data: laborEntries }, { data: estimates }] = await Promise.all([
    supabase.from("branches").select("id, code, city, display_name, status").eq("organization_id", staff.organizationId).order("city"),
    canOperations ? supabase.from("repair_orders").select("id, branch_id, status, risk_state, opened_at, closed_at, promised_at").eq("organization_id", staff.organizationId) : Promise.resolve({ data: [] }),
    canOperations ? supabase.from("appointments").select("id, branch_id, status, start_at").eq("organization_id", staff.organizationId) : Promise.resolve({ data: [] }),
    canOperations ? supabase.from("stock_balances").select("branch_id, on_hand, reserved, average_cost").eq("organization_id", staff.organizationId) : Promise.resolve({ data: [] }),
    canOperations ? supabase.from("vehicle_recommendations").select("branch_id, status, severity").eq("organization_id", staff.organizationId) : Promise.resolve({ data: [] }),
    canFinance ? supabase.from("invoices").select("branch_id, status, grand_total, paid_total, tax_total").eq("organization_id", staff.organizationId) : Promise.resolve({ data: [] }),
    canFinance ? supabase.from("payments").select("branch_id, status, amount").eq("organization_id", staff.organizationId) : Promise.resolve({ data: [] }),
    canFinance ? supabase.from("payment_refunds").select("branch_id, status, amount").eq("organization_id", staff.organizationId) : Promise.resolve({ data: [] }),
    canOperations ? supabase.from("jobs").select("branch_id, status, planned_minutes").eq("organization_id", staff.organizationId) : Promise.resolve({ data: [] }),
    canOperations ? supabase.from("labor_entries").select("branch_id, started_at, ended_at").eq("organization_id", staff.organizationId) : Promise.resolve({ data: [] }),
    canOperations ? supabase.from("estimate_versions").select("branch_id, status").eq("organization_id", staff.organizationId) : Promise.resolve({ data: [] }),
  ]);
  const branchRows = (branches ?? []).map((branch) => {
    const branchOrders = (orders ?? []).filter((item) => item.branch_id === branch.id);
    const branchInvoices = (invoices ?? []).filter((item) => item.branch_id === branch.id && item.status !== "void");
    const branchPayments = (payments ?? []).filter((item) => item.branch_id === branch.id && ["received", "partially_refunded", "refunded"].includes(item.status));
    const branchBalances = (balances ?? []).filter((item) => item.branch_id === branch.id);
    const branchJobs = (jobs ?? []).filter((item) => item.branch_id === branch.id);
    const branchLabor = (laborEntries ?? []).filter((item) => item.branch_id === branch.id);
    const branchEstimates = (estimates ?? []).filter((item) => item.branch_id === branch.id && ["approved", "declined"].includes(item.status));
    const completedOrders = branchOrders.filter((item) => item.closed_at);
    const actualMinutes = branchLabor.reduce((sum,item)=>sum+(item.ended_at?Math.max(0,new Date(item.ended_at).getTime()-new Date(item.started_at).getTime())/60000:0),0);
    const plannedMinutes = branchJobs.filter(item=>!["cancelled"].includes(item.status)).reduce((sum,item)=>sum+item.planned_minutes,0);
    return {
      ...branch,
      openOrders: branchOrders.filter((item) => !["closed", "cancelled"].includes(item.status)).length,
      overdue: branchOrders.filter((item) => item.promised_at && new Date(item.promised_at) < new Date() && !["closed", "cancelled"].includes(item.status)).length,
      appointments: (appointments ?? []).filter((item) => item.branch_id === branch.id && ["requested", "confirmed", "checked_in"].includes(item.status)).length,
      noShows: (appointments ?? []).filter((item) => item.branch_id === branch.id && item.status === "no_show").length,
      averageCycleHours: completedOrders.length ? completedOrders.reduce((sum,item)=>sum+(new Date(item.closed_at!).getTime()-new Date(item.opened_at).getTime())/3600000,0)/completedOrders.length : 0,
      laborAttainment: plannedMinutes ? actualMinutes/plannedMinutes*100 : 0,
      approvalRate: branchEstimates.length ? branchEstimates.filter(item=>item.status==="approved").length/branchEstimates.length*100 : 0,
      inventoryValue: branchBalances.reduce((sum, item) => sum + item.on_hand * item.average_cost, 0),
      availableUnits: branchBalances.reduce((sum, item) => sum + Math.max(0, item.on_hand - item.reserved), 0),
      safetyDeferred: (recommendations ?? []).filter((item) => item.branch_id === branch.id && item.severity === "safety_stop" && !["completed", "dismissed"].includes(item.status)).length,
      billed: branchInvoices.filter((item) => item.status !== "draft").reduce((sum, item) => sum + item.grand_total, 0),
      outstanding: branchInvoices.reduce((sum, item) => sum + Math.max(0, item.grand_total - item.paid_total), 0),
      collected: branchPayments.reduce((sum, item) => sum + item.amount, 0) - (refunds ?? []).filter((item) => item.branch_id === branch.id && item.status === "recorded").reduce((sum, item) => sum + item.amount, 0),
    };
  });
  const totalOpen = branchRows.reduce((sum, item) => sum + item.openOrders, 0);
  const totalInventory = branchRows.reduce((sum, item) => sum + item.inventoryValue, 0);
  const totalBilled = branchRows.reduce((sum, item) => sum + item.billed, 0);
  const totalOutstanding = branchRows.reduce((sum, item) => sum + item.outstanding, 0);
  const completedCycleRows = branchRows.filter(item=>item.averageCycleHours>0);
  const networkCycle = completedCycleRows.length ? completedCycleRows.reduce((sum,item)=>sum+item.averageCycleHours,0)/completedCycleRows.length : 0;
  const decidedEstimates = (estimates??[]).filter(item=>["approved","declined"].includes(item.status));
  const networkApproval = decidedEstimates.length ? decidedEstimates.filter(item=>item.status==="approved").length/decidedEstimates.length*100 : 0;
  const totalNoShows = (appointments??[]).filter(item=>item.status==="no_show").length;

  return <><PageHeader eyebrow="Live multi-branch intelligence" title="Operations & finance reports" description="Compare service load, inventory exposure and commercial position across cities using current ledger data." />
    <MetricStrip metrics={[
      { label: "Open work orders", value: canOperations ? String(totalOpen) : "Restricted", note: "Across accessible branches", icon: Wrench },
      { label: "Inventory value", value: canOperations ? `${money.format(totalInventory)} JOD` : "Restricted", note: "Moving-average valuation", icon: Boxes },
      { label: "Billed", value: canFinance ? `${money.format(totalBilled)} JOD` : "Restricted", note: "Posted non-void invoices", icon: CircleDollarSign },
      { label: "Outstanding", value: canFinance ? `${money.format(totalOutstanding)} JOD` : "Restricted", note: "Invoice balance due", noteTone: totalOutstanding ? "warn" : "good", icon: Clock3 },
    ]} />
    {canOperations ? <MetricStrip metrics={[
      { label: "Average cycle", value: `${networkCycle.toFixed(1)}h`, note: "Opened to closed repair order", icon: Clock3 },
      { label: "Estimate approval", value: `${networkApproval.toFixed(1)}%`, note: `${decidedEstimates.length} decided estimates`, noteTone: networkApproval>=70?"good":"warn", icon: BarChart3 },
      { label: "No-shows", value: String(totalNoShows), note: "Recorded appointment outcomes", noteTone: totalNoShows?"warn":"good", icon: CalendarDays },
      { label: "Safety-stop deferred", value: String(branchRows.reduce((sum,item)=>sum+item.safetyDeferred,0)), note: "Open critical recommendations", noteTone: branchRows.some(item=>item.safetyDeferred)?"warn":"good", icon: ShieldAlert },
    ]} /> : null}
    {!branchRows.length ? <EmptyState icon={BarChart3} title="No branches to report" description="Create the first operating branch to begin multi-city comparison." /> : <section className="panel branch-scoreboard"><div className="panel-header"><div><div className="panel-title">Branch scoreboard</div><div className="panel-subtitle">Permission-aware operational and commercial measures.</div></div></div><div className="data-scroll"><table className="data-table"><thead><tr><th>Branch</th>{canOperations ? <><th>Open / overdue</th><th>Appointments / no-show</th><th>Cycle</th><th>Labor attainment</th><th>Approval</th><th>Available stock</th><th>Safety deferred</th></> : null}{canFinance ? <><th>Billed</th><th>Collected</th><th>Outstanding</th></> : null}<th>Status</th></tr></thead><tbody>{branchRows.map((branch) => <tr key={branch.id}><td><div className="cell-main">{branch.city} · {branch.display_name}</div><div className="cell-sub mono">{branch.code}</div></td>{canOperations ? <><td><strong>{branch.openOrders}</strong> / <span className={branch.overdue ? "text-danger" : ""}>{branch.overdue}</span></td><td>{branch.appointments} / {branch.noShows}</td><td>{branch.averageCycleHours.toFixed(1)}h</td><td>{branch.laborAttainment.toFixed(1)}%</td><td>{branch.approvalRate.toFixed(1)}%</td><td>{branch.availableUnits.toFixed(2)}</td><td>{branch.safetyDeferred}</td></> : null}{canFinance ? <><td>{money.format(branch.billed)}</td><td>{money.format(branch.collected)}</td><td>{money.format(branch.outstanding)}</td></> : null}<td><StatusPill label={branch.status} tone={branch.status === "active" ? "green" : "gray"} /></td></tr>)}</tbody></table></div></section>}
  </>;
}
