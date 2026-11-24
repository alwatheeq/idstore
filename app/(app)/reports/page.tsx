import { ResponsiveTable } from "@/components/responsive-table";
import { LocalizedContent } from "@/components/localized-content";
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
  const canOperations = staff.role === "admin" || staff.permissionCodes.includes("report.operations.read");
  const canFinance = staff.role === "admin" || staff.permissionCodes.includes("report.finance.read");
  if (!canOperations && !canFinance) return <LocalizedContent>{<><PageHeader eyebrow="Permission controlled" title="Branch reports" description="Operational and financial reporting permissions are assigned independently." /><EmptyState icon={ShieldAlert} title="Reporting access is not assigned" description="Ask an administrator for operational or financial report access." /></>}</LocalizedContent>;

  const { data, error } = await supabase.rpc("branch_report", { p_organization_id: staff.organizationId });
  if (error || !Array.isArray(data)) throw new Error("Reports could not be loaded. Please retry.");
  const branchRows = data as Array<{
    id: string; code: string; city: string; display_name: string; status: string;
    openOrders: number; overdue: number; appointments: number; noShows: number;
    averageCycleHours: number; completedCount: number; laborAttainment: number; approvalRate: number;
    approvedCount: number; decidedCount: number; inventoryValue: number; availableUnits: number;
    safetyDeferred: number; billed: number; outstanding: number; collected: number;
  }>;
  const totalOpen = branchRows.reduce((sum, item) => sum + item.openOrders, 0);
  const totalInventory = branchRows.reduce((sum, item) => sum + item.inventoryValue, 0);
  const totalBilled = branchRows.reduce((sum, item) => sum + item.billed, 0);
  const totalOutstanding = branchRows.reduce((sum, item) => sum + item.outstanding, 0);
  const completedCount = branchRows.reduce((sum, row) => sum + row.completedCount, 0);
  const networkCycle = completedCount ? branchRows.reduce((sum, row) => sum + row.averageCycleHours * row.completedCount, 0) / completedCount : 0;
  const decidedCount = branchRows.reduce((sum, row) => sum + row.decidedCount, 0);
  const networkApproval = decidedCount ? branchRows.reduce((sum, row) => sum + row.approvedCount, 0) / decidedCount * 100 : 0;
  const totalNoShows = branchRows.reduce((sum, row) => sum + row.noShows, 0);

  return <LocalizedContent>{<><PageHeader eyebrow="Live multi-branch intelligence" title="Operations & finance reports" description="Compare service load, inventory exposure and commercial position across cities using current ledger data." />
    <MetricStrip metrics={[
      { label: "Open work orders", value: canOperations ? String(totalOpen) : "Restricted", note: "Across accessible branches", icon: Wrench },
      { label: "Inventory value", value: canOperations ? `${money.format(totalInventory)} JOD` : "Restricted", note: "Moving-average valuation", icon: Boxes },
      { label: "Billed", value: canFinance ? `${money.format(totalBilled)} JOD` : "Restricted", note: "Posted non-void invoices", icon: CircleDollarSign },
      { label: "Outstanding", value: canFinance ? `${money.format(totalOutstanding)} JOD` : "Restricted", note: "Invoice balance due", noteTone: totalOutstanding ? "warn" : "good", icon: Clock3 },
    ]} />
    {canOperations ? <MetricStrip metrics={[
      { label: "Average cycle", value: `${networkCycle.toFixed(1)}h`, note: "Opened to closed repair order", icon: Clock3 },
      { label: "Estimate approval", value: `${networkApproval.toFixed(1)}%`, note: `${decidedCount} decided estimates`, noteTone: networkApproval>=70?"good":"warn", icon: BarChart3 },
      { label: "No-shows", value: String(totalNoShows), note: "Recorded appointment outcomes", noteTone: totalNoShows?"warn":"good", icon: CalendarDays },
      { label: "Safety-stop deferred", value: String(branchRows.reduce((sum,item)=>sum+item.safetyDeferred,0)), note: "Open critical recommendations", noteTone: branchRows.some(item=>item.safetyDeferred)?"warn":"good", icon: ShieldAlert },
    ]} /> : null}
    {!branchRows.length ? <EmptyState icon={BarChart3} title="No branches to report" description="Create the first operating branch to begin multi-city comparison." /> : <section className="panel branch-scoreboard"><div className="panel-header"><div><div className="panel-title">Branch scoreboard</div><div className="panel-subtitle">Permission-aware operational and commercial measures.</div></div></div><div className="data-scroll"><ResponsiveTable className="data-table"><thead><tr><th>Branch</th>{canOperations ? <><th>Open / overdue</th><th>Appointments / no-show</th><th>Cycle</th><th>Labor attainment</th><th>Approval</th><th>Available stock</th><th>Safety deferred</th></> : null}{canFinance ? <><th>Billed</th><th>Collected</th><th>Outstanding</th></> : null}<th>Status</th></tr></thead><tbody>{branchRows.map((branch) => <tr key={branch.id}><td><div className="cell-main">{branch.city} · {branch.display_name}</div><div className="cell-sub mono">{branch.code}</div></td>{canOperations ? <><td><strong>{branch.openOrders}</strong> / <span className={branch.overdue ? "text-danger" : ""}>{branch.overdue}</span></td><td>{branch.appointments} / {branch.noShows}</td><td>{branch.averageCycleHours.toFixed(1)}h</td><td>{branch.laborAttainment.toFixed(1)}%</td><td>{branch.approvalRate.toFixed(1)}%</td><td>{branch.availableUnits.toFixed(2)}</td><td>{branch.safetyDeferred}</td></> : null}{canFinance ? <><td>{money.format(branch.billed)}</td><td>{money.format(branch.collected)}</td><td>{money.format(branch.outstanding)}</td></> : null}<td><StatusPill label={branch.status} tone={branch.status === "active" ? "green" : "gray"} /></td></tr>)}</tbody></ResponsiveTable></div></section>}
  </>}</LocalizedContent>;
}
