import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, ShieldCheck, UserRoundCog } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { MetricStrip } from "@/components/metric-strip";
import { PageHeader } from "@/components/page-header";
import { RecordFeedback } from "@/components/record-feedback";
import { StatusPill } from "@/components/status-pill";
import { callingCodes } from "@/lib/auth/mobile";
import { getCurrentStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { provisionStaff } from "./actions";

type PageQuery = { new?: string; created?: string; error?: string };

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export default async function StaffPage({ searchParams }: { searchParams: Promise<PageQuery> }) {
  const query = await searchParams;
  const current = await getCurrentStaff();
  if (current.role !== "admin") redirect("/dashboard");
  const supabase = await createClient();
  const [{ data: branches }, { data: permissions }, { data: memberships, error }] = await Promise.all([
    supabase.from("branches").select("id, code, city").eq("organization_id", current.organizationId).eq("status", "active").order("city"),
    supabase.from("permissions").select("code, description").order("code"),
    supabase.from("memberships").select("id, user_id, role, all_branches, status, created_at").eq("organization_id", current.organizationId).order("created_at"),
  ]);

  const userIds = (memberships ?? []).map((membership) => membership.user_id);
  const membershipIds = (memberships ?? []).map((membership) => membership.id);
  const [{ data: profiles }, { data: branchAccess }, { data: permissionAccess }, { data: technicians }] = userIds.length ? await Promise.all([
    supabase.from("profiles").select("user_id, display_name, phone, status").in("user_id", userIds),
    membershipIds.length ? supabase.from("membership_branches").select("membership_id, branch:branches(code, city)").in("membership_id", membershipIds) : Promise.resolve({ data: [] }),
    membershipIds.length ? supabase.from("membership_permissions").select("membership_id, permission_code, allowed").in("membership_id", membershipIds) : Promise.resolve({ data: [] }),
    supabase.from("technician_profiles").select("id, user_id, employee_no, labor_grade, active, technician_qualifications(valid_to, qualification_type:qualification_types(code, name))").eq("organization_id", current.organizationId),
  ]) : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const profileByUser = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));
  const technicianByUser = new Map((technicians ?? []).map((technician) => [technician.user_id, technician]));
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const activeUsers = (memberships ?? []).filter((membership) => membership.status === "active").length;
  const admins = (memberships ?? []).filter((membership) => membership.role === "admin" && membership.status === "active").length;
  const qualified = (technicians ?? []).filter((technician) => technician.active && technician.technician_qualifications.some((qualification) => !qualification.valid_to || qualification.valid_to >= today)).length;
  const expiringCutoff = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const expiring = (technicians ?? []).flatMap((technician) => technician.technician_qualifications).filter((qualification) => qualification.valid_to && qualification.valid_to >= today && qualification.valid_to <= expiringCutoff).length;
  const showForm = (query.new === "1" || Boolean(query.error)) && Boolean(branches?.length);

  return <>
    <PageHeader eyebrow="Identity & access" title="Staff and access" description="Provision Admin or Staff accounts, assign cities and grant only the capabilities each job requires.">
      {branches?.length ? <Link className="button primary" href="/staff?new=1#new-staff"><Plus /> Add staff account</Link> : <Link className="button primary" href="/branches?new=1#new-branch"><Plus /> Create a branch first</Link>}
    </PageHeader>
    <RecordFeedback created={query.created} error={query.error ?? (error ? "Staff records could not be loaded." : undefined)} />

    {showForm ? <section className="panel operation-form" id="new-staff">
      <div className="panel-header"><div><div className="panel-title">Provision a staff account</div><div className="panel-subtitle">Creates the mobile/PIN identity and access assignment together.</div></div><Link className="panel-link" href="/staff">Cancel</Link></div>
      <form action={provisionStaff} className="form-grid panel-body">
        <div className="form-field"><label htmlFor="staff-name">Display name</label><input id="staff-name" name="displayName" autoComplete="name" required /></div>
        <div className="form-field"><label htmlFor="staff-role">Role</label><select id="staff-role" name="role" defaultValue="staff"><option value="staff">Staff · assigned access</option><option value="admin">Admin · all branches and capabilities</option></select></div>
        <div className="form-field"><label htmlFor="staff-mobile">Mobile number</label><div className="phone-control"><select name="dialCode" defaultValue="+962" aria-label="Country and calling code">{callingCodes.map((country) => <option key={country.iso} value={country.dialCode}>{country.iso} {country.dialCode}</option>)}</select><input id="staff-mobile" name="mobile" type="tel" inputMode="tel" autoComplete="tel-national" required /></div></div>
        <div className="form-field"><label htmlFor="staff-pin">Initial 6-digit PIN</label><input className="pin-input" id="staff-pin" name="pin" type="password" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{6}" minLength={6} maxLength={6} required /><span className="field-help">Share the PIN through a secure channel.</span></div>

        <fieldset className="access-fieldset form-span-2"><legend>Branch access</legend><p>Staff require at least one branch. Admin accounts automatically receive all branches.</p><div className="access-grid">{branches?.map((branch) => <label className="check-field" key={branch.id}><input name="branchId" type="checkbox" value={branch.id} /><span><strong>{branch.city}</strong><small>{branch.code}</small></span></label>)}</div></fieldset>
        <fieldset className="access-fieldset form-span-2"><legend>Capability grants</legend><p>Choose only what this Staff member needs. Admin accounts receive every capability automatically.</p><div className="permission-grid">{permissions?.map((permission) => <label className="check-field" key={permission.code}><input name="permissionCode" type="checkbox" value={permission.code} /><span><strong>{permission.code.replaceAll(".", " ")}</strong><small>{permission.description}</small></span></label>)}</div></fieldset>
        <label className="check-field form-span-2"><input name="isTechnician" type="checkbox" /><span><strong>Create technician profile</strong><small>Enable job assignment and qualification tracking for this user.</small></span></label>
        <div className="form-field"><label htmlFor="staff-employee">Employee number</label><input id="staff-employee" name="employeeNo" /></div>
        <div className="form-field"><label htmlFor="staff-grade">Labor grade</label><input id="staff-grade" name="laborGrade" placeholder="Technician, Senior, Master" /></div>
        <div className="form-actions form-span-2"><Link className="button" href="/staff">Cancel</Link><button className="button primary" type="submit">Create account</button></div>
      </form>
    </section> : null}

    <MetricStrip metrics={[
      { label: "Active users", value: String(activeUsers), note: `${branches?.length ?? 0} active branches`, icon: UserRoundCog },
      { label: "Administrators", value: String(admins), note: "Organization-wide access", icon: ShieldCheck },
      { label: "Qualified technicians", value: String(qualified), note: "Current qualification record", noteTone: qualified ? "good" : undefined, icon: ShieldCheck },
      { label: "Expiring credentials", value: String(expiring), note: "Within 30 days", noteTone: expiring ? "warn" : "good", icon: ShieldCheck },
    ]} />

    {!memberships?.length ? <EmptyState icon={UserRoundCog} title="No staff memberships" description="Add the first staff account and assign its operating branches." action={branches?.length ? <Link className="button primary" href="/staff?new=1#new-staff">Add staff account</Link> : undefined} /> : <section className="panel">
      <div className="panel-header"><div><div className="panel-title">Access roster</div><div className="panel-subtitle">Live roles, branch assignments and explicit capability grants</div></div></div>
      <div className="data-scroll"><table className="data-table"><thead><tr><th>Staff member</th><th>Role</th><th>Branch access</th><th>Capabilities</th><th>Technician profile</th><th>Status</th></tr></thead><tbody>{memberships.map((membership) => {
        const profile = profileByUser.get(membership.user_id);
        const assignedBranches = (branchAccess ?? []).filter((item) => item.membership_id === membership.id).map((item) => item.branch ? `${item.branch.city} · ${item.branch.code}` : null).filter(Boolean);
        const grants = (permissionAccess ?? []).filter((item) => item.membership_id === membership.id && item.allowed);
        const technician = technicianByUser.get(membership.user_id);
        const qualification = technician?.technician_qualifications.find((item) => !item.valid_to || item.valid_to >= today);
        const displayName = profile?.display_name ?? "Unlinked profile";
        return <tr key={membership.id}><td><div style={{ display: "flex", alignItems: "center", gap: 10 }}><div className="avatar">{initials(displayName)}</div><div><div className="cell-main">{displayName}</div><div className="cell-sub mono">{profile?.phone ?? membership.user_id.slice(0, 8)}</div></div></div></td><td><StatusPill label={membership.role} tone={membership.role === "admin" ? "blue" : "gray"} /></td><td>{membership.all_branches ? "All branches" : assignedBranches.join(", ") || "No branch"}</td><td>{membership.role === "admin" ? "All capabilities" : `${grants.length} granted`}</td><td>{technician ? <><div className="cell-main">{technician.labor_grade ?? "Technician"}</div><div className="cell-sub">{qualification?.qualification_type?.name ?? "No active qualification"}</div></> : "—"}</td><td><StatusPill label={membership.status} tone={membership.status === "active" && profile?.status === "active" ? "green" : "amber"} /></td></tr>;
      })}</tbody></table></div>
    </section>}
  </>;
}
