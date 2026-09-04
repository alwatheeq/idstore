import Link from "next/link";
import { AlertTriangle, BatteryCharging, CalendarClock, CircleDollarSign, ClipboardCheck, Clock3, Plus, Wrench } from "lucide-react";
import { MetricStrip } from "@/components/metric-strip";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { branches, workOrders } from "@/lib/demo-data";

const tone = {
  diagnosis: "blue", awaiting_approval: "amber", in_progress: "blue", qc: "amber", ready: "green",
} as const;

export default function DashboardPage() {
  return (
    <>
      <PageHeader eyebrow="Thursday · 4 September" title="Service control room" description="Live workshop flow, branch capacity and safety exceptions across the network.">
        <button className="button"><CalendarClock /> Book visit</button><button className="button primary"><Plus /> Open work order</button>
      </PageHeader>
      <MetricStrip metrics={[
        { label: "Vehicles on site", value: "34", note: "+5 since opening", noteTone: "good", icon: Wrench },
        { label: "Due before 14:00", value: "11", note: "3 require attention", noteTone: "warn", icon: Clock3 },
        { label: "Awaiting approval", value: "6", note: "JOD 2,418 pending", noteTone: "warn", icon: ClipboardCheck },
        { label: "Revenue today", value: "JOD 4.8k", note: "+12.4% vs last Thu", noteTone: "good", icon: CircleDollarSign },
      ]} />
      <div className="grid-main">
        <section className="panel">
          <div className="panel-header"><div><div className="panel-title">Workshop lane</div><div className="panel-subtitle">Priority jobs ordered by promised delivery</div></div><Link className="panel-link" href="/work-orders">View all work orders →</Link></div>
          <div className="lane-list">
            {workOrders.map((order) => (
              <div className="lane-row" key={order.id}>
                <div><div className="cell-main mono">{order.number}</div><div className={`risk-flag ${order.risk}`}>{order.risk === "normal" ? null : <AlertTriangle size={11} />}{order.risk}</div></div>
                <div><div className="cell-main">{order.vehicle} · {order.registration}</div><div className="cell-sub">{order.customer} · Advisor {order.advisor}</div><div className="progress-track"><div className="progress-fill" style={{ width: `${order.progress}%` }} /></div></div>
                <StatusPill label={order.status} tone={tone[order.status]} />
                <div><div className="cell-sub">Promised</div><div className="cell-main mono">{order.promise}</div></div>
                <button className="button">Open</button>
              </div>
            ))}
          </div>
        </section>
        <aside className="stack">
          <section className="panel"><div className="panel-header"><div><div className="panel-title">Branch load</div><div className="panel-subtitle">Live bay utilization</div></div></div><div className="panel-body">{branches.map((branch) => <div className="util-row" key={branch.id}><div className="util-top"><div><div className="util-name">{branch.city}</div><div className="util-meta">{branch.activeJobs} active jobs</div></div><strong className="mono">{branch.utilization}%</strong></div><div className="util-track"><div className={`util-fill ${branch.utilization > 75 ? "hot" : ""}`} style={{ width: `${branch.utilization}%` }} /></div></div>)}</div></section>
          <section className="panel"><div className="panel-header"><div><div className="panel-title">Action required</div><div className="panel-subtitle">Operational exceptions</div></div></div><div className="panel-body alert-list">
            <div className="alert-item"><div className="alert-icon"><BatteryCharging /></div><div><strong>HV quarantine · RO-24093</strong><span>Insulation test failed. Safety lead review required.</span></div></div>
            <div className="alert-item"><div className="alert-icon"><AlertTriangle /></div><div><strong>2 parts below safety stock</strong><span>12V battery and underbody fastener set.</span></div></div>
            <div className="alert-item"><div className="alert-icon"><Clock3 /></div><div><strong>3 customer approvals ageing</strong><span>Oldest estimate has waited 2h 18m.</span></div></div>
          </div></section>
        </aside>
      </div>
    </>
  );
}
