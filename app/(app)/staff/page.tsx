import { LocalizedContent } from "@/components/localized-content";
import { RecordAction } from "@/components/record-action";
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
import { StaffEditor, DeleteStaffForm } from "@/components/staff-editor";

type PageQuery = { new?: string; created?: string; error?: string; edit?: string; delete?: string; show?: string };

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export default async function StaffPage({ searchParams }: { searchParams: Promise<PageQuery> }) {
  const query = await searchParams;
  const current = await getCurrentStaff();
  if (current.role !== "admin") redirect("/dashboard");
  const supabase = await createClient();
  const [{ data: branches, error: branchesError }, { data: permissions, error: permissionsError }, { data: memberships, error }] = await Promise.all([
    supabase.from("branches").select("id, code, city").eq("organization_id", current.organizationId).eq("status", "active").order("city"),
    supabase.from("permissions").select("code, description").neq("code", "hv_permit.authorize").order("code"),
    supabase.from("memberships").select("id, user_id, role, all_branches, status, created_at").eq("organization_id", current.organizationId).order("created_at"),
  ]);

  const userIds = (memberships ?? []).map((membership) => membership.user_id);
  const membershipIds = (memberships ?? []).map((membership) => membership.id);
  const [{ data: profiles, error: profilesError }, { data: branchAccess, error: branchAccessError }, { data: permissionAccess, error: permissionAccessError }, { data: technicians, error: techniciansError }] = userIds.length ? await Promise.all([
    supabase.from("profiles").select("user_id, display_name, phone, status").in("user_id", userIds),
    membershipIds.length ? supabase.from("membership_branches").select("membership_id, branch_id, branch:branches(code, city)").in("membership_id", membershipIds) : Promise.resolve({ data: [], error: null }),
    membershipIds.length ? supabase.from("membership_permissions").select("membership_id, permission_code, allowed").neq("permission_code", "hv_permit.authorize").in("membership_id", membershipIds) : Promise.resolve({ data: [], error: null }),
    supabase.from("technician_profiles").select("id, user_id, employee_no, labor_grade, active").eq("organization_id", current.organizationId),
  ]) : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }, { data: [], error: null }];

  const profileByUser = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));
  const technicianByUser = new Map((technicians ?? []).map((technician) => [technician.user_id, technician]));
  const activeUsers = (memberships ?? []).filter((membership) => membership.status === "active").length;
  const admins = (memberships ?? []).filter((membership) => membership.role === "admin" && membership.status === "active").length;
  const showForm = (query.new === "1" || Boolean(query.error && !query.edit && !query.delete)) && Boolean(branches?.length);
  const loadError = error || branchesError || permissionsError || profilesError || branchAccessError || permissionAccessError || techniciansError;
  const selected = !loadError ? memberships?.find(member => member.id === (query.edit || query.delete)) : undefined;
  const selectedProfile = selected ? profileByUser.get(selected.user_id) : undefined;
  const selectedTech = selected ? technicianByUser.get(selected.user_id) : undefined;
  const visibleMemberships = (memberships ?? []).filter(member => query.show === "deleted" ? member.status === "revoked" : member.status !== "revoked");

  return <LocalizedContent>{<>
    <PageHeader eyebrow="Identity & access" title="Staff and access" description="Provision Admin or Staff accounts, assign cities and grant only the capabilities each job requires.">
      {branches?.length ? <Link className="button primary" href="/staff?new=1#new-staff"><Plus /> Add staff account</Link> : <Link className="button primary" href="/branches?new=1#new-branch"><Plus /> Create a branch first</Link>}
    </PageHeader>
    <RecordFeedback created={query.created} error={query.error ?? (loadError ? "Staff records could not be loaded." : undefined)} />
    <nav className="settings-tabs" aria-label="Staff list"><Link href="/staff" className={query.show !== "deleted" ? "active" : ""}>Staff</Link><Link href="/staff?show=deleted" className={query.show === "deleted" ? "active" : ""}>Deleted staff</Link></nav>
    {selected && query.edit && selectedProfile ? <section className="panel operation-form" id="edit-staff"><div className="panel-header"><div className="panel-title">Edit staff</div><RecordAction kind="close" label="Close" href="/staff" /></div>
      <StaffEditor key={selected.id} staff={{ membershipId: selected.id, displayName: selectedProfile.display_name, phone: selectedProfile.phone ?? "", role: selected.role, status: selected.status, branchIds: (branchAccess ?? []).filter(item => item.membership_id === selected.id).map(item => item.branch_id), permissionCodes: (permissionAccess ?? []).filter(item => item.membership_id === selected.id && item.allowed).map(item => item.permission_code), isTechnician: Boolean(selectedTech?.active), employeeNo: selectedTech?.employee_no ?? "", laborGrade: selectedTech?.labor_grade ?? "", isSelf: selected.user_id === current.userId }} branches={branches ?? []} permissions={permissions ?? []} />
    </section> : null}
    {selected && query.delete && selected.user_id !== current.userId && selected.status !== "revoked" ? <section className="panel operation-form" id="delete-staff"><div className="panel-header"><div className="panel-title">Delete staff</div></div><DeleteStaffForm membershipId={selected.id} displayName={selectedProfile?.display_name ?? ""} /></section> : null}

    {showForm ? <section className="panel operation-form" id="new-staff">
      <div className="panel-header"><div><div className="panel-title">Provision a staff account</div><div className="panel-subtitle">Creates the mobile/PIN identity and access assignment together.</div></div><Link className="panel-link" href="/staff">Cancel</Link></div>
      <form action={provisionStaff} className="form-grid panel-body">
        <div className="form-field"><label htmlFor="staff-name">Display name</label><input id="staff-name" name="displayName" autoComplete="name" required /></div>
        <div className="form-field"><label htmlFor="staff-role">Role</label><select id="staff-role" name="role" defaultValue="staff"><option value="staff">Staff · assigned access</option><option value="admin">Admin · all branches and capabilities</option></select></div>
        <div className="form-field"><label htmlFor="staff-mobile">Mobile number</label><div className="phone-control"><select name="dialCode" defaultValue="+962" aria-label="Country and calling code">{callingCodes.map((country) => <option key={country.iso} value={country.dialCode}>{country.iso} {country.dialCode}</option>)}</select><input id="staff-mobile" name="mobile" type="tel" inputMode="tel" autoComplete="tel-national" required /></div></div>
        <div className="form-field"><label htmlFor="staff-pin">Initial 6-digit PIN</label><input className="pin-input" id="staff-pin" name="pin" type="password" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{6}" minLength={6} maxLength={6} required /><span className="field-help">Share the PIN through a secure channel.</span></div>

        <fieldset className="access-fieldset form-span-2"><legend>Branch access</legend><p>Staff require at least one branch. Admin accounts automatically receive all branches.</p><div className="access-grid">{branches?.map((branch) => <label className="check-field" key={branch.id}><input name="branchId" type="checkbox" value={branch.id} /><span><strong>{branch.city}</strong><small>{branch.code}</small></span></label>)}</div></fieldset>
        <fieldset className="access-fieldset form-span-2"><legend>Capability grants</legend><p>Choose only what this Staff member needs. Admin accounts receive every capability automatically.</p><div className="permission-grid">{permissions?.map((permission) => <label className="check-field" key={permission.code}><input name="permissionCode" type="checkbox" value={permission.code} /><span><strong>{permission.code.replaceAll(".", " ")}</strong><small>{permission.description}</small></span></label>)}</div></fieldset>
        <label className="check-field form-span-2"><input name="isTechnician" type="checkbox" /><span><strong>Create technician profile</strong><small>Enable maintenance job assignment for this user.</small></span></label>
        <div className="form-field"><label htmlFor="staff-employee">Employee number</label><input id="staff-employee" name="employeeNo" /></div>
        <div className="form-field"><label htmlFor="staff-grade">Labor grade</label><input id="staff-grade" name="laborGrade" placeholder="Technician, Senior, Master" /></div>
        <div className="form-actions form-span-2"><Link className="button" href="/staff">Cancel</Link><button className="button primary" type="submit">Create account</button></div>
      </form>
    </section> : null}

    <MetricStrip metrics={[
      { label: "Active users", value: String(activeUsers), note: `${branches?.length ?? 0} active branches`, icon: UserRoundCog },
      { label: "Administrators", value: String(admins), note: "Organization-wide access", icon: ShieldCheck },
      { label: "Active technicians", value: String((technicians ?? []).filter(technician => technician.active).length), note: "Available for maintenance jobs", icon: UserRoundCog },
      { label: "Service branches", value: String(branches?.length ?? 0), note: "Available assignment scope", icon: UserRoundCog },
    ]} />

    {!memberships?.length ? <EmptyState icon={UserRoundCog} title="No staff memberships" description="Add the first staff account and assign its operating branches." action={branches?.length ? <Link className="button primary" href="/staff?new=1#new-staff">Add staff account</Link> : undefined} /> : <section className="panel">
      <div className="panel-header"><div><div className="panel-title">Access roster</div><div className="panel-subtitle">Live roles, branch assignments and explicit capability grants</div></div></div>
      <div className="data-scroll"><table className="data-table"><thead><tr><th>Staff member</th><th>Role</th><th>Branch access</th><th>Capabilities</th><th>Technician profile</th><th>Status</th><th>Actions</th></tr></thead><tbody>{visibleMemberships.map((membership) => {
        const profile = profileByUser.get(membership.user_id);
        const assignedBranches = (branchAccess ?? []).filter((item) => item.membership_id === membership.id).map((item) => item.branch ? `${item.branch.city} · ${item.branch.code}` : null).filter(Boolean);
        const grants = (permissionAccess ?? []).filter((item) => item.membership_id === membership.id && item.allowed);
        const technician = technicianByUser.get(membership.user_id);
        const displayName = profile?.display_name ?? "Unlinked profile";
        return <tr key={membership.id}><td><div style={{ display: "flex", alignItems: "center", gap: 10 }}><div className="avatar">{initials(displayName)}</div><div><div className="cell-main">{displayName}</div><div className="cell-sub mono">{profile?.phone ?? membership.user_id.slice(0, 8)}</div></div></div></td><td><StatusPill label={membership.role} tone={membership.role === "admin" ? "blue" : "gray"} /></td><td>{membership.all_branches ? "All branches" : assignedBranches.join(", ") || "No branch"}</td><td>{membership.role === "admin" ? "All capabilities" : `${grants.length} granted`}</td><td>{technician ? <><div className="cell-main">{technician.labor_grade ?? "Technician"}</div><div className="cell-sub">{technician.employee_no ?? "—"}</div></> : "—"}</td><td><StatusPill label={membership.status} tone={membership.status === "active" && profile?.status === "active" ? "green" : "amber"} /></td><td><div className="inline-actions"><RecordAction kind={membership.status === "revoked" ? "restore" : "edit"} href={`/staff?edit=${membership.id}#edit-staff`} />{membership.user_id !== current.userId && membership.status !== "revoked" ? <RecordAction kind="delete" label="Delete" href={`/staff?delete=${membership.id}#delete-staff`} /> : null}</div></td></tr>;
      })}</tbody></table></div>
    </section>}
  </>}</LocalizedContent>;
}
