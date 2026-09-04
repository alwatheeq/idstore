import { CalendarDays, Plus } from "lucide-react";
import { MetricStrip } from "@/components/metric-strip";
import { PageHeader } from "@/components/page-header";

const slots = [
  { time: "08:00", entries: ["ID.4 · Lina H.", "", "ID.3 · Ahmad K.", ""] },
  { time: "09:30", entries: ["", "ID.5 · Omar Q.", "", "ID. Buzz · Fleet 8"] },
  { time: "11:00", entries: ["ID.7 · Sama Mobility", "ID.4 · Yara M.", "", ""] },
  { time: "13:00", entries: ["", "ID.3 · Rami S.", "ID.4 · Tareq S.", "ID.5 · Noor A."] },
  { time: "14:30", entries: ["ID. Buzz · Maha", "", "ID.7 · Saleh N.", ""] },
];

export default function AppointmentsPage() {
  return <><PageHeader eyebrow="Reception planning" title="Appointments" description="Schedule arrivals against advisors, bays, equipment and high-voltage-qualified capacity."><button className="button">Today</button><button className="button primary"><Plus /> New appointment</button></PageHeader>
    <MetricStrip metrics={[{ label: "Arrivals today", value: "27", note: "19 checked in", noteTone: "good", icon: CalendarDays },{ label: "Available slots", value: "8", note: "Across all branches", icon: CalendarDays },{ label: "No-show rate", value: "3.1%", note: "Below 5% target", noteTone: "good", icon: CalendarDays },{ label: "HV bookings", value: "6", note: "Capacity confirmed", icon: CalendarDays }]} />
    <section className="panel"><div className="panel-header"><div><div className="panel-title">Amman schedule</div><div className="panel-subtitle">Thursday, 4 September · drag-and-drop scheduling follows in Phase 3</div></div><div className="header-actions"><button className="button">Previous</button><button className="button">Next</button></div></div><div className="data-scroll"><div className="appointment-grid"><div className="calendar-cell header">Time</div>{["Advisor Rami", "Advisor Dana", "Bay 01 · HV", "Bay 02"].map((head) => <div className="calendar-cell header" key={head}>{head}</div>)}{slots.flatMap((slot, slotIndex) => [<div className="calendar-cell time mono" key={`${slot.time}-time`}>{slot.time}</div>, ...slot.entries.map((entry, index) => <div className="calendar-cell" key={`${slot.time}-${index}`}>{entry ? <div className={`booking ${slotIndex === 3 && index === 2 ? "amber" : ""}`}><strong>{entry}</strong>{slotIndex === 3 && index === 2 ? "HV diagnostic" : "Scheduled service"}</div> : null}</div>)])}</div></div></section></>;
}
