import { LocalizedContent } from "@/components/localized-content";
import Link from "next/link";
import { LabeledControl } from "@/components/labeled-control";
import { IntakeIdentityFields } from "@/components/intake-identity-fields";
import { ClipboardList, Plus, TimerReset, Wrench } from "lucide-react";
import { BranchField } from "@/components/branch-field";
import { EmptyState } from "@/components/empty-state";
import { MetricStrip } from "@/components/metric-strip";
import { PageHeader } from "@/components/page-header";
import { RecordFeedback } from "@/components/record-feedback";
import { StatusPill } from "@/components/status-pill";
import { getCurrentStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { assignJob, createJob, createReworkJob, createWorkOrder, finishJob, interruptJob, recordJobNarrative, resumeJob, startJob, transitionWorkOrder } from "./actions";
import { workOrderConcernIssues } from "./concerns";
import { WorkOrderInspection } from "@/components/work-order-inspection";
import { MaintenanceOrderItems } from "@/components/maintenance-order-items";

type PageQuery = { order?: string; customer?: string; vehicle?: string; new?: string; job?: string; view?: string; created?: string; error?: string };
type PillTone = "blue" | "green" | "amber" | "red" | "gray";

const progressByStatus: Record<string, number> = {
  draft: 3, checked_in: 8, diagnosis: 18, awaiting_approval: 32, approved: 42,
  in_progress: 64, qc: 86, ready: 96, delivered: 100, closed: 100,
  cancelled: 100, on_hold: 48,
};

function statusTone(status: string): PillTone {
  if (["ready", "delivered", "closed", "completed"].includes(status)) return "green";
  if (["awaiting_approval", "qc", "on_hold", "paused", "blocked"].includes(status)) return "amber";
  if (status === "cancelled") return "gray";
  return "blue";
}

function orderActions(status: string) {
  const map: Record<string, { value: string; label: string }[]> = {
    checked_in: [{ value: "diagnosis", label: "Start diagnosis" }, { value: "on_hold", label: "Hold" }],
    diagnosis: [{ value: "awaiting_approval", label: "Request approval" }, { value: "approved", label: "Approve" }, { value: "on_hold", label: "Hold" }],
    awaiting_approval: [{ value: "approved", label: "Approve" }, { value: "diagnosis", label: "Return to diagnosis" }],
    approved: [{ value: "in_progress", label: "Begin repair" }, { value: "on_hold", label: "Hold" }],
    in_progress: [{ value: "qc", label: "Send to QC" }, { value: "on_hold", label: "Hold" }],
    qc: [{ value: "ready", label: "Mark ready" }, { value: "in_progress", label: "Return to workshop" }],
    ready: [{ value: "delivered", label: "Deliver" }, { value: "in_progress", label: "Reopen" }],
    delivered: [{ value: "closed", label: "Close order" }],
    on_hold: [{ value: "in_progress", label: "Resume" }, { value: "diagnosis", label: "Resume diagnosis" }],
  };
  return map[status] ?? [];
}

export default async function WorkOrdersPage({ searchParams }: { searchParams: Promise<PageQuery> }) {
  const query = await searchParams;
  const staff = await getCurrentStaff();
  const supabase = await createClient();
  const [{ data: branches }, { data: customers }, { data: vehicles }, { data: workOrderRows, error }, { data: technicians }, { data: jobRows }] = await Promise.all([
    supabase.from("branches").select("id, code, city").eq("organization_id", staff.organizationId).eq("status", "active").order("city"),
    supabase.from("customers").select("id, display_name").eq("organization_id", staff.organizationId).eq("status", "active").order("display_name"),
    supabase.from("vehicles").select("id, vin, registration_no, model:vehicle_models(name), vehicle_ownerships(customer_id, valid_from, valid_to, customer:customers(display_name))").eq("organization_id", staff.organizationId).eq("status", "active").order("registration_no"),
    supabase.from("repair_orders").select("id, branch_id, ro_number, order_type, status, risk_state, odometer_km, state_of_charge, customer_concern, opened_at, promised_at, version, customer:customers(display_name), vehicle:vehicles(registration_no, model:vehicle_models(name)), branch:branches(display_name, city)").eq("organization_id", staff.organizationId).order("opened_at", { ascending: false }),
    supabase.from("technician_profiles").select("id, user_id, employee_no, labor_grade, active").eq("organization_id", staff.organizationId).eq("active", true).order("employee_no"),
    supabase.from("jobs").select("id, branch_id, repair_order_id, operation_code, description_snapshot, status, safety_class, planned_minutes, started_at, completed_at, version, cause_text, correction_text, original_job_id, rework_kind, rework_reason, repair_order:repair_orders(ro_number), job_assignments(technician_id, assignment_kind, assigned_at, unassigned_at), labor_entries(technician_id, started_at, ended_at), job_interruptions(interruption_type, reason, started_at, ended_at)").eq("organization_id", staff.organizationId).order("created_at", { ascending: false }),
  ]);
  // Explicit links locate an accessible historical record even if the header
  // currently selects another branch. Supabase RLS remains the access boundary.
  const workOrders = query.order ? (workOrderRows ?? []).filter(order => order.id === query.order) : staff.selectedBranchId ? (workOrderRows ?? []).filter((order) => order.branch_id === staff.selectedBranchId) : (workOrderRows ?? []);
  const jobs = query.order ? (jobRows ?? []).filter(job => job.repair_order_id === query.order) : staff.selectedBranchId ? (jobRows ?? []).filter((job) => job.branch_id === staff.selectedBranchId) : (jobRows ?? []);
  const advanced = query.view === "advanced" || query.job === "new";
  const selectedOrder = query.order ? workOrders[0] : undefined;

  const setupReady = Boolean(branches?.length && customers?.length && vehicles?.length);
  const showForm = query.new === "1" || Boolean(query.error && !query.job && !query.order);
  const activeOrders = workOrders.filter((order) => !["delivered", "closed", "cancelled"].includes(order.status));
  const showJobForm = query.job === "new" && activeOrders.length > 0;
  const currentTechnician = technicians?.find((technician) => technician.user_id === staff.userId);
  const now = new Date();
  const activeTimers = jobs.filter((job) => job.status === "in_progress").length;
  const blockedJobs = jobs.filter((job) => job.status === "blocked").length;
  const unassignedJobs = jobs.filter((job) => !job.job_assignments.some((assignment) => assignment.unassigned_at === null && assignment.assignment_kind === "primary") && !["completed", "cancelled"].includes(job.status)).length;

  return <LocalizedContent>{<>
    <PageHeader eyebrow="Workshop" title="Work orders" description="Start with the work order, inspect reported issues, then select services and spare parts.">
      <Link className="button" href={advanced ? `/work-orders${query.order ? `?order=${query.order}` : ""}` : `/work-orders?view=advanced${query.order ? `&order=${query.order}` : ""}`}>{advanced ? "Simple view" : "Advanced"}</Link>
      {advanced && activeOrders.length ? <Link className="button" href="/work-orders?job=new#new-job"><Wrench /> Add workshop job</Link> : null}
      {setupReady ? <Link className="button primary" href="/work-orders?new=1#new-work-order"><Plus /> New work order</Link> : <Link className="button primary" href={branches?.length ? customers?.length ? "/vehicles?new=1#new-vehicle" : "/customers?new=1#new-customer" : "/branches?new=1#new-branch"}><Plus /> Complete setup</Link>}
    </PageHeader>
    <RecordFeedback created={query.created} error={query.error ?? (error ? "Work orders could not be loaded." : undefined)} />

    {showForm && setupReady ? <section className="panel operation-form" id="new-work-order">
      <div className="panel-header"><div><div className="panel-title">Open a work order</div><div className="panel-subtitle">Allocates the next branch repair-order number and records vehicle intake.</div></div><Link className="panel-link" href="/work-orders">Cancel</Link></div>
      <form action={createWorkOrder} className="form-grid panel-body">
        <div className="form-field"><label htmlFor="work-order-type">Work order type</label><select id="work-order-type" name="orderType" required><option value="maintenance">Maintenance</option><option value="bodyshop">Bodyshop</option></select></div>
        <BranchField id="work-branch" label="Branch" branches={branches} selectedBranchId={staff.selectedBranchId} />
        <IntakeIdentityFields customers={customers ?? []} initialCustomerId={query.customer} initialVehicleId={query.vehicle} vehicles={(vehicles ?? []).map(vehicle => ({ ...vehicle, customerIds: vehicle.vehicle_ownerships.filter(o => o.valid_from <= new Date().toISOString().slice(0,10) && (!o.valid_to || o.valid_to >= new Date().toISOString().slice(0,10))).map(o => o.customer_id) }))} />
        <div className="form-field form-span-2"><label htmlFor="work-concern-notes">Notes (optional)</label><textarea id="work-concern-notes" name="customerConcernNotes" rows={2} maxLength={2000} /></div>
        <details className="service-options form-span-2"><summary>Intake details (optional)</summary><div className="form-grid">
        <div className="form-field"><label htmlFor="work-odometer">Odometer (km)</label><input id="work-odometer" name="odometerKm" type="number" min="0" step="1" /></div>
        <div className="form-field"><label htmlFor="work-charge">State of charge (%)</label><input id="work-charge" name="stateOfCharge" type="number" min="0" max="100" step="0.1" /></div>
        <div className="form-field"><label htmlFor="work-promise">Promised handover</label><input id="work-promise" name="promisedAt" type="datetime-local" /></div>
        <fieldset className="concern-capture form-span-2">
          <legend>Customer concern</legend>
          <div className="concern-capture-head"><div><strong>Reported issues</strong><span>Select every symptom mentioned by the customer.</span></div><span>Multiple selection</span></div>
          <div className="concern-option-grid">
            {workOrderConcernIssues.map((issue) => <label className="concern-option" key={issue.code}><input type="checkbox" name="concernIssue" value={issue.code} /><span>{issue.label}</span></label>)}
          </div>
        </fieldset>
        </div></details>
        <div className="form-actions form-span-2"><Link className="button" href="/work-orders">Cancel</Link><button className="button primary" type="submit">Open work order</button></div>
      </form>
    </section> : null}

    {showJobForm ? <section className="panel operation-form" id="new-job">
      <div className="panel-header"><div><div className="panel-title">Add a workshop job</div><div className="panel-subtitle">Describe the maintenance task and planned labor time.</div></div><Link className="panel-link" href="/work-orders">Cancel</Link></div>
      <form action={createJob} className="form-grid panel-body">
        <div className="form-field"><label htmlFor="job-order">Work order</label><select id="job-order" name="repairOrderId" required><option value="">Select work order</option>{activeOrders.map((order) => <option key={order.id} value={order.id}>{order.ro_number} · {order.vehicle?.registration_no}</option>)}</select></div>
        <div className="form-field"><label htmlFor="job-code">Operation code</label><input className="mono" id="job-code" name="operationCode" placeholder="DIAG-MEB" /></div>
        <div className="form-field form-span-2"><label htmlFor="job-description">Job description</label><input id="job-description" name="description" required /></div>
        <div className="form-field"><label htmlFor="job-minutes">Planned minutes</label><input id="job-minutes" name="plannedMinutes" type="number" min="0" max="1440" step="5" defaultValue="60" required /></div>
        <div className="form-actions form-span-2"><Link className="button" href="/work-orders">Cancel</Link><button className="button primary" type="submit">Create job</button></div>
      </form>
    </section> : null}

    {!advanced && selectedOrder ? <div className="stack" id="work-order-workspace">
      <section className="panel"><div className="panel-header"><div><div className="panel-title"><bdi dir="ltr">{selectedOrder.ro_number}</bdi> · <span>{selectedOrder.order_type === "bodyshop" ? "Bodyshop" : "Maintenance"}</span></div><div className="panel-subtitle"><bdi>{selectedOrder.customer?.display_name}</bdi> · <bdi dir="ltr">{selectedOrder.vehicle?.model?.name}</bdi> · <bdi dir="ltr">{selectedOrder.vehicle?.registration_no}</bdi> · {selectedOrder.branch?.city}</div></div><Link className="panel-link" href="/work-orders">All orders</Link></div>
        <div className="panel-body inline-actions"><StatusPill label={selectedOrder.status} tone={statusTone(selectedOrder.status)} />{selectedOrder.customer_concern ? <p className="field-help">{selectedOrder.customer_concern}</p> : null}</div>
      </section>
      <WorkOrderInspection orderId={selectedOrder.id} organizationId={staff.organizationId} />
      <MaintenanceOrderItems orderType={selectedOrder.order_type} orderId={selectedOrder.id} organizationId={staff.organizationId} status={selectedOrder.status} branchLocked={Boolean(staff.selectedBranchId && selectedOrder.branch_id !== staff.selectedBranchId)} />
    </div> : null}

    {!advanced && workOrders.length && !selectedOrder ? <section className="panel"><div className="panel-header"><div className="panel-title">Work orders</div></div><div className="data-scroll"><table className="data-table"><thead><tr><th>Order</th><th>Customer & vehicle</th><th>Work order type</th><th>Status</th><th>Actions</th></tr></thead><tbody>{workOrders.map(order => <tr key={order.id}>
      <td><Link className="cell-main" href={`/work-orders?order=${order.id}#work-order-workspace`}>{order.ro_number}</Link><div className="cell-sub">{order.branch?.city}</div></td>
      <td><div className="cell-main">{order.customer?.display_name}</div><div className="cell-sub">{order.vehicle?.model?.name} · <bdi>{order.vehicle?.registration_no}</bdi></div></td>
      <td>{order.order_type === "bodyshop" ? "Bodyshop" : "Maintenance"}</td><td><StatusPill label={order.status} tone={statusTone(order.status)} /></td><td><Link className="button compact" href={`/work-orders?order=${order.id}#work-order-workspace`}>Open</Link></td>
    </tr>)}</tbody></table></div></section> : null}

    {advanced ? <MetricStrip metrics={[
      { label: "Active work orders", value: String(activeOrders.length), note: "Across accessible branches", icon: ClipboardList },
      { label: "Workshop jobs", value: String(jobs?.length ?? 0), note: "Live job ledger", icon: Wrench },
      { label: "Active timers", value: String(activeTimers), note: "Technicians recording labor", noteTone: activeTimers ? "good" : undefined, icon: TimerReset },
      { label: "Needs dispatch", value: String(unassignedJobs + blockedJobs), note: `${unassignedJobs} unassigned · ${blockedJobs} blocked`, noteTone: unassignedJobs + blockedJobs ? "warn" : "good", icon: Wrench },
    ]} /> : null}

    {!workOrders?.length ? <EmptyState icon={ClipboardList} title="No work orders open" description={setupReady ? "Open the first work order when a vehicle arrives for service." : "A branch, customer and registered vehicle are required first."} action={setupReady ? <Link className="button primary" href="/work-orders?new=1#new-work-order">Open first work order</Link> : undefined} /> : advanced ? <div className="stack">
      <section className="panel"><div className="panel-header"><div><div className="panel-title">Repair-order control</div><div className="panel-subtitle">Valid next states are enforced by the database</div></div></div><div className="data-scroll"><table className="data-table work-order-ledger"><thead><tr><th>Order</th><th>Customer & vehicle</th><th>Branch</th><th>Status</th><th>Risk</th><th>Progress</th><th>Next action</th></tr></thead><tbody>{workOrders.map((order) => {
        const progress = progressByStatus[order.status] ?? 0;
        return <tr key={order.id} id={`order-${order.id}`}><td><div className="cell-main mono">{order.ro_number}</div><div className="cell-sub">Opened {new Date(order.opened_at).toLocaleDateString("en-JO")}</div></td><td><div className="cell-main">{order.vehicle?.model?.name ?? "Volkswagen ID"} · {order.vehicle?.registration_no ?? "No registration"}</div><div className="cell-sub">{order.customer?.display_name ?? "Unknown customer"}</div></td><td>{order.branch?.city ?? order.branch?.display_name ?? "—"}</td><td><StatusPill label={order.status} tone={statusTone(order.status)} /></td><td><StatusPill label={order.risk_state} tone={order.risk_state === "quarantine" || order.risk_state === "emergency_escalation" ? "red" : order.risk_state === "restricted" ? "amber" : "gray"} /></td><td style={{ minWidth: 110 }}><div className="cell-sub mono">{progress}%</div><div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div></td><td><div className="inline-actions"><Link className="button compact" href={`/inspections?order=${order.id}#inspection-workspace`}>Inspect</Link><Link className="button compact" href={`/estimates?order=${order.id}#estimate-workspace`}>Estimate</Link>{orderActions(order.status).map((action) => <form action={transitionWorkOrder} key={action.value}><input type="hidden" name="repairOrderId" value={order.id} /><input type="hidden" name="version" value={order.version} /><input type="hidden" name="toStatus" value={action.value} /><button className={`button compact ${action.value === orderActions(order.status)[0]?.value ? "primary" : ""}`} type="submit">{action.label}</button></form>)}</div></td></tr>;
      })}</tbody></table></div></section>

      <section className="panel"><div className="panel-header"><div><div className="panel-title">Technician job ledger</div><div className="panel-subtitle">Assignment, safety classification, cause/correction and interruption evidence</div></div></div><div className="data-scroll"><table className="data-table workshop-job-ledger"><thead><tr><th>Job</th><th>Work order</th><th>Plan / actual</th><th>Primary technician</th><th>Status</th><th>Evidence</th><th>Dispatch or timer</th></tr></thead><tbody>{(jobs ?? []).map((job) => {
        const primary = job.job_assignments.find((assignment) => assignment.assignment_kind === "primary" && assignment.unassigned_at === null);
        const technician = technicians?.find((item) => item.id === primary?.technician_id);
        const minutes = job.labor_entries.reduce((total, entry) => {
          const end = entry.ended_at ? new Date(entry.ended_at).getTime() : now.getTime();
          return total + Math.max(0, end - new Date(entry.started_at).getTime()) / 60000;
        }, 0);
        const mine = Boolean(currentTechnician && job.job_assignments.some((assignment) => assignment.technician_id === currentTechnician.id && assignment.unassigned_at === null));
        const canOperate = mine || (staff.role === "admin" && Boolean(technician || job.labor_entries.some(entry => !entry.ended_at)));
        const dispatchForm = <div className="inline-actions"><form action={assignJob} className="assign-control"><input type="hidden" name="jobId" value={job.id} /><input type="hidden" name="version" value={job.version} /><LabeledControl label="Technician"><select name="technicianId" aria-label="Technician" required defaultValue={primary?.technician_id ?? ""}><option value="">Choose technician</option>{technicians?.map((item) => <option key={item.id} value={item.id}>{item.employee_no ?? item.id.slice(0, 8)} · {item.labor_grade ?? "Technician"}</option>)}</select></LabeledControl><button className="button compact" type="submit">Assign</button></form></div>;
        const action = job.safety_class.startsWith("hv_") ? <span className="field-help">Outside maintenance scope</span> : canOperate && job.status === "in_progress" ? <div className="stack"><div className="inline-actions">{[{ value: "qc", label: "Send QC" }, { value: "completed", label: "Complete" }].map((outcome) => <form action={finishJob} key={outcome.value}><input type="hidden" name="jobId" value={job.id} /><input type="hidden" name="version" value={job.version} /><input type="hidden" name="outcome" value={outcome.value} /><button className={`button compact ${outcome.value === "completed" ? "primary" : ""}`} type="submit">{outcome.label}</button></form>)}</div><form action={interruptJob} className="assign-control"><input type="hidden" name="jobId" value={job.id}/><input type="hidden" name="version" value={job.version}/><LabeledControl label="Interruption type"><select name="interruptionType" aria-label="Interruption type"><option value="pause">Pause</option><option value="blocked">Block</option></select></LabeledControl><LabeledControl label="Interruption reason"><input name="reason" aria-label="Interruption reason" placeholder="Required reason" required/></LabeledControl><button className="button compact" type="submit">Record</button></form></div>
          : canOperate && ["assigned", "ready"].includes(job.status) ? <div className="inline-actions"><form action={startJob}><input type="hidden" name="jobId" value={job.id} /><input type="hidden" name="version" value={job.version} /><button className="button compact primary" type="submit">Start timer</button></form></div>
          : canOperate && ["paused", "blocked"].includes(job.status) ? <div className="inline-actions"><form action={resumeJob}><input type="hidden" name="jobId" value={job.id}/><input type="hidden" name="version" value={job.version}/><button className="button compact primary" type="submit">Resume to queue</button></form></div>
          : !["in_progress", "completed", "cancelled", "qc"].includes(job.status) && technicians?.length ? dispatchForm
          : "—";
        const controls = staff.role === "admin" && canOperate && !job.safety_class.startsWith("hv_") && ["assigned", "ready", "paused", "blocked"].includes(job.status) ? <div className="stack">{action}{dispatchForm}</div> : action;
        const latestInterruption = [...job.job_interruptions].sort((a,b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0];
        return <tr key={job.id}><td><div className="cell-main">{job.description_snapshot}</div><div className="cell-sub mono">{job.operation_code ?? job.id.slice(0, 8)}</div>{job.rework_kind ? <div className="cell-sub">{job.rework_kind}: {job.rework_reason}</div> : null}</td><td className="mono">{job.repair_order?.ro_number}</td><td><div className="cell-main mono">{job.planned_minutes}m / {Math.round(minutes)}m</div></td><td>{technician ? <><div className="cell-main">{technician.employee_no ?? `Tech ${technician.id.slice(0, 6)}`}</div><div className="cell-sub">{technician.labor_grade ?? "Technician"}</div></> : "Unassigned"}</td><td><StatusPill label={job.status} tone={statusTone(job.status)} /></td><td>{job.cause_text && job.correction_text && staff.role !== "admin" ? <><div className="cell-main">Cause: {job.cause_text}</div><div className="cell-sub">Correction: {job.correction_text}</div></> : <form action={recordJobNarrative} className="stack"><input type="hidden" name="jobId" value={job.id}/><LabeledControl label="Cause"><input name="causeText" aria-label="Cause" placeholder="Cause" defaultValue={job.cause_text ?? ""} required/></LabeledControl><LabeledControl label="Correction"><input name="correctionText" aria-label="Correction" placeholder="Correction" defaultValue={job.correction_text ?? ""} required/></LabeledControl><button className="button compact" type="submit">Save narrative</button></form>}{latestInterruption ? <div className="cell-sub">{latestInterruption.interruption_type}: {latestInterruption.reason}</div> : null}{job.status === "completed" ? <form action={createReworkJob} className="stack"><input type="hidden" name="jobId" value={job.id}/><LabeledControl label="Rework type"><select name="reworkKind" aria-label="Rework type"><option value="rework">Rework</option><option value="comeback">Comeback</option></select></LabeledControl><LabeledControl label="Rework reason"><input name="reason" aria-label="Rework reason" placeholder="Required reason" required/></LabeledControl><button className="button compact" type="submit">Create follow-up</button></form> : null}</td><td>{controls}</td></tr>;
      })}{!jobs?.length ? <tr><td colSpan={8}><div className="table-empty">No workshop jobs yet. Add the first job from an active work order.</div></td></tr> : null}</tbody></table></div></section>
    </div> : null}
  </>}</LocalizedContent>;
}
