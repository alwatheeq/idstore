import { Plus, ShieldCheck, UserRoundCog } from "lucide-react";
import { MetricStrip } from "@/components/metric-strip";
import { PageHeader } from "@/components/page-header";
import { SearchFilters } from "@/components/search-filters";
import { StatusPill } from "@/components/status-pill";

const staff = [
  { initials: "MA", name: "Moatasem Ayyash", email: "admin@idstore.jo", role: "Admin", branches: "All branches", qualification: "HV-3", status: "Active" },
  { initials: "RH", name: "Rami Haddad", email: "rami@idstore.jo", role: "Staff", branches: "Amman", qualification: "HV-2", status: "Active" },
  { initials: "DN", name: "Dana Nasser", email: "dana@idstore.jo", role: "Staff", branches: "Amman · Irbid", qualification: "HV-1", status: "Active" },
  { initials: "FS", name: "Fadi Saadi", email: "fadi@idstore.jo", role: "Staff", branches: "Aqaba", qualification: "HV-2", status: "Active" },
  { initials: "YA", name: "Yazan Ali", email: "yazan@idstore.jo", role: "Staff", branches: "Irbid", qualification: "General", status: "Invited" },
];

export default function StaffPage() {
  return <><PageHeader eyebrow="Identity & access" title="Staff and access" description="Two internal roles—Admin and Staff—with branch assignments, capability grants and technician qualifications."><button className="button primary"><Plus /> Invite staff</button></PageHeader>
    <MetricStrip metrics={[{ label: "Active users", value: "42", note: "3 branches", icon: UserRoundCog },{ label: "Administrators", value: "3", note: "Organization-wide access", icon: ShieldCheck },{ label: "HV-qualified", value: "18", note: "6 at HV-3 level", noteTone: "good", icon: ShieldCheck },{ label: "Expiring credentials", value: "2", note: "Within 30 days", noteTone: "warn", icon: ShieldCheck }]} />
    <section className="panel"><div className="panel-body"><SearchFilters placeholder="Search staff name or email…" filters={["All roles", "All branches", "All qualifications"]} /></div><div className="data-scroll"><table className="data-table"><thead><tr><th>Staff member</th><th>Role</th><th>Branch access</th><th>Qualification</th><th>Status</th></tr></thead><tbody>{staff.map((person) => <tr key={person.email}><td><div style={{ display: "flex", alignItems: "center", gap: 10 }}><div className="avatar">{person.initials}</div><div><div className="cell-main">{person.name}</div><div className="cell-sub">{person.email}</div></div></div></td><td><StatusPill label={person.role} tone={person.role === "Admin" ? "blue" : "gray"} /></td><td>{person.branches}</td><td>{person.qualification}</td><td><StatusPill label={person.status} tone={person.status === "Active" ? "green" : "amber"} /></td></tr>)}</tbody></table></div></section></>;
}
