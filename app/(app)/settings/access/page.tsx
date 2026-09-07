import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, Check, KeyRound, LockKeyhole, ShieldCheck, UserCog, UsersRound } from "lucide-react";
import { MetricStrip } from "@/components/metric-strip";
import { PageHeader } from "@/components/page-header";
import { RecordFeedback } from "@/components/record-feedback";
import { StatusPill } from "@/components/status-pill";
import { getCurrentStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { updateMembershipAccess } from "./actions";

type PageQuery = { member?: string; created?: string; error?: string };
type Permission = { code: string; description: string };

const permissionSections = [
  { key: "reception", title: "Reception & customer care", note: "Customer, vehicle, appointment and estimate workflows", codes: ["crm.manage", "appointments.manage", "repair_order.manage", "inspection.perform", "estimate.manage"] },
  { key: "workshop", title: "Workshop", note: "Dispatch, maintenance work and price exceptions", codes: ["workshop.dispatch", "job.perform", "estimate.override_price"] },
  { key: "supply", title: "Parts & supply", note: "Stock control, counts, suppliers and purchasing", codes: ["inventory.manage", "purchasing.manage"] },
  { key: "finance", title: "Finance & reporting", note: "Posting, collections, refunds and financial visibility", codes: ["invoice.post", "payment.receive", "payment.refund", "report.finance.read"] },
  { key: "governance", title: "Network governance", note: "Branch configuration, staff, reporting, integrations and audit", codes: ["branch.manage", "staff.manage", "report.operations.read", "integration.manage", "audit.read"] },
] as const;

const permissionLabels: Record<string, string> = {
  "appointments.manage": "Appointments",
  "audit.read": "Audit history",
  "branch.manage": "Branch settings",
  "crm.manage": "Customer records",
  "estimate.manage": "Estimates",
  "estimate.override_price": "Price overrides",
  "inspection.perform": "Inspections",
  "integration.manage": "Integrations",
  "inventory.manage": "Inventory",
  "invoice.post": "Invoice posting",
  "job.perform": "Technician work",
  "payment.receive": "Payments",
  "payment.refund": "Refunds",
  "purchasing.manage": "Purchasing",
  "repair_order.manage": "Work orders",
  "report.finance.read": "Finance reports",
  "report.operations.read": "Operations reports",
  "staff.manage": "Staff access",
  "workshop.dispatch": "Workshop dispatch",
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export default async function AccessSettingsPage({ searchParams }: { searchParams: Promise<PageQuery> }) {
  const query = await searchParams;
  const current = await getCurrentStaff();
  if (current.role !== "admin") redirect("/dashboard");

  const supabase = await createClient();
  const [{ data: branches }, { data: permissions }, { data: memberships, error }] = await Promise.all([
    supabase.from("branches").select("id, code, city, display_name").eq("organization_id", current.organizationId).eq("status", "active").order("city"),
    supabase.from("permissions").select("code, description").neq("code", "hv_permit.authorize").order("code"),
    supabase.from("memberships").select("id, user_id, role, all_branches, status, created_at").eq("organization_id", current.organizationId).order("created_at"),
  ]);

  const membershipIds = (memberships ?? []).map((membership) => membership.id);
  const userIds = (memberships ?? []).map((membership) => membership.user_id);
  const [{ data: profiles }, { data: branchAccess }, { data: permissionAccess }] = await Promise.all([
    userIds.length ? supabase.from("profiles").select("user_id, display_name, phone, status").in("user_id", userIds) : Promise.resolve({ data: [] }),
    membershipIds.length ? supabase.from("membership_branches").select("membership_id, branch_id").in("membership_id", membershipIds) : Promise.resolve({ data: [] }),
    membershipIds.length ? supabase.from("membership_permissions").select("membership_id, permission_code, allowed").neq("permission_code", "hv_permit.authorize").in("membership_id", membershipIds) : Promise.resolve({ data: [] }),
  ]);

  const profileByUser = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));
  const selectedMembership = (memberships ?? []).find((membership) => membership.id === query.member)
    ?? (memberships ?? []).find((membership) => membership.user_id !== current.userId)
    ?? memberships?.[0];
  const selectedProfile = selectedMembership ? profileByUser.get(selectedMembership.user_id) : undefined;
  const selectedBranchIds = new Set((branchAccess ?? []).filter((item) => item.membership_id === selectedMembership?.id).map((item) => item.branch_id));
  const selectedPermissions = new Set((permissionAccess ?? []).filter((item) => item.membership_id === selectedMembership?.id && item.allowed).map((item) => item.permission_code));
  const permissionByCode = new Map((permissions ?? []).map((permission) => [permission.code, permission as Permission]));
  const adminCount = (memberships ?? []).filter((membership) => membership.role === "admin" && membership.status === "active").length;
  const staffCount = (memberships ?? []).filter((membership) => membership.role === "staff" && membership.status === "active").length;
  const grantCount = (permissionAccess ?? []).filter((permission) => permission.allowed).length;

  return <>
    <PageHeader eyebrow="Settings · Identity & access" title="Roles & permissions" description="Control who can work in each city and which service, stock, finance or governance actions they can perform.">
      <Link className="button" href="/staff">Staff accounts</Link>
    </PageHeader>
    <RecordFeedback created={query.created} error={query.error ?? (error ? "Access records could not be loaded." : undefined)} />

    <nav className="settings-tabs" aria-label="Settings sections">
      <Link href="/branches">Branches</Link>
      <Link href="/staff">Staff accounts</Link>
      <Link className="active" aria-current="page" href="/settings/access"><KeyRound /> Roles & permissions</Link>
      <Link href="/catalog">Service catalog</Link>
      <Link href="/governance">Integrations</Link>
    </nav>

    <MetricStrip metrics={[
      { label: "Active administrators", value: String(adminCount), note: "Organization-wide control", icon: ShieldCheck, noteTone: "good" },
      { label: "Active Staff", value: String(staffCount), note: "Scoped by branch and capability", icon: UsersRound },
      { label: "Explicit grants", value: String(grantCount), note: "Across Staff accounts", icon: KeyRound },
      { label: "Service branches", value: String(branches?.length ?? 0), note: "Available assignment scope", icon: Building2 },
    ]} />

    <div className="access-dashboard">
      <aside className="panel access-roster">
        <div className="panel-header"><div><div className="panel-title">People</div><div className="panel-subtitle">Choose an account to configure</div></div><span className="roster-count">{memberships?.length ?? 0}</span></div>
        <div className="access-roster-list">{(memberships ?? []).map((membership) => {
          const profile = profileByUser.get(membership.user_id);
          const name = profile?.display_name ?? "Unlinked profile";
          const branchCount = (branchAccess ?? []).filter((item) => item.membership_id === membership.id).length;
          const permissionCount = (permissionAccess ?? []).filter((item) => item.membership_id === membership.id && item.allowed).length;
          return <Link className={`access-person ${selectedMembership?.id === membership.id ? "active" : ""}`} href={`/settings/access?member=${membership.id}`} key={membership.id}>
            <span className="avatar">{initials(name)}</span>
            <span className="access-person-copy"><strong>{name}</strong><small>{profile?.phone ?? "No phone"}</small><span>{membership.role === "admin" ? "All branches · All capabilities" : `${branchCount} branches · ${permissionCount} grants`}</span></span>
            <StatusPill label={membership.status} tone={membership.status === "active" ? "green" : "amber"} />
          </Link>;
        })}</div>
      </aside>

      {selectedMembership ? <form action={updateMembershipAccess} className="panel access-console">
        <input name="membershipId" type="hidden" value={selectedMembership.id} />
        <div className="access-console-head">
          <div className="avatar access-avatar">{initials(selectedProfile?.display_name ?? "User")}</div>
          <div><span>Editing access for</span><h2>{selectedProfile?.display_name ?? "Unlinked profile"}</h2><p>{selectedProfile?.phone ?? selectedMembership.user_id}</p></div>
          <StatusPill label={selectedMembership.role} tone={selectedMembership.role === "admin" ? "blue" : "gray"} />
        </div>

        <section className="access-section">
          <div className="access-section-heading"><span>01</span><div><h3>Role & account state</h3><p>Admin has unrestricted organization access. Staff follows the branch and capability selections below.</p></div></div>
          <div className="role-choice-grid">
            <label className="role-choice"><input name="role" type="radio" value="staff" defaultChecked={selectedMembership.role === "staff"} /><span><UserCog /><strong>Staff</strong><small>Assigned access only</small></span></label>
            <label className="role-choice elevated"><input name="role" type="radio" value="admin" defaultChecked={selectedMembership.role === "admin"} /><span><ShieldCheck /><strong>Admin</strong><small>All branches and capabilities</small></span></label>
          </div>
          <div className="form-field access-status"><label htmlFor="account-status">Account status</label><select id="account-status" name="status" defaultValue={selectedMembership.status === "suspended" ? "suspended" : "active"}><option value="active">Active</option><option value="suspended">Suspended</option></select></div>
        </section>

        <section className="access-section">
          <div className="access-section-heading"><span>02</span><div><h3>Branch scope</h3><p>Staff must have at least one service branch. Admin accounts always cover the full network.</p></div></div>
          <div className="branch-scope-grid">{branches?.map((branch) => <label className="scope-choice" key={branch.id}><input name="branchId" type="checkbox" value={branch.id} defaultChecked={selectedMembership.role === "admin" || selectedBranchIds.has(branch.id)} /><span className="scope-check"><Check /></span><span><strong>{branch.city}</strong><small>{branch.code} · {branch.display_name}</small></span></label>)}</div>
        </section>

        <section className="access-section">
          <div className="access-section-heading"><span>03</span><div><h3>Capability grants</h3><p>Grant the minimum set needed for the person’s responsibilities. Changes take effect on their next request.</p></div></div>
          <div className="permission-sections">{permissionSections.map((section) => <fieldset className="permission-section" key={section.key}>
            <legend><strong>{section.title}</strong><small>{section.note}</small></legend>
            <div>{section.codes.map((code) => {
              const permission = permissionByCode.get(code);
              if (!permission) return null;
              return <label className="permission-choice" key={code}><input name="permissionCode" type="checkbox" value={code} defaultChecked={selectedMembership.role === "admin" || selectedPermissions.has(code)} /><span className="scope-check"><Check /></span><span><strong>{permissionLabels[code] ?? code.replaceAll(".", " ")}</strong><small>{permission.description}</small></span></label>;
            })}</div>
          </fieldset>)}</div>
        </section>

        <div className="access-savebar"><div><LockKeyhole /><span><strong>Audited change</strong><small>Role, status, branch scope and grants are saved together.</small></span></div><button className="button primary" type="submit">Save</button></div>
      </form> : <section className="panel access-console-empty"><UsersRound /><h2>No staff accounts</h2><p>Create a staff account before assigning roles and permissions.</p><Link className="button primary" href="/staff?new=1#new-staff">Add staff</Link></section>}
    </div>
  </>;
}
