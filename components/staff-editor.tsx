"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useUiLocale } from "@/components/ui-locale";
import { manageStaff } from "@/app/(app)/staff/actions";

export type StaffEditorRecord = {
  membershipId: string; displayName: string; phone: string; role: "admin" | "staff"; status: string;
  branchIds: string[]; permissionCodes: string[]; isTechnician: boolean; employeeNo: string; laborGrade: string; isSelf: boolean;
};
export function StaffEditor({ staff, branches, permissions }: {
  staff: StaffEditorRecord; branches: { id: string; city: string; code: string }[]; permissions: { code: string; description: string }[];
}) {
  const { pageText: t } = useUiLocale();
  const [role, setRole] = useState(staff.role);
  const [state, action, pending] = useActionState(manageStaff, { error: "" });
  return <form action={action} className="form-grid panel-body">
    <input type="hidden" name="staffAction" value="edit" /><input type="hidden" name="membershipId" value={staff.membershipId} />
    <div className="form-field"><label htmlFor="edit-staff-name">{t("Display name")}</label><input id="edit-staff-name" name="displayName" defaultValue={staff.displayName} required maxLength={160} /></div>
    <div className="form-field"><label htmlFor="edit-staff-phone">{t("Mobile number")}</label><input id="edit-staff-phone" value={staff.phone} readOnly dir="ltr" /><span className="field-help">{t("Login mobile is unchanged by this form.")}</span></div>
    <div className="form-field"><label htmlFor="edit-staff-role">{t("Role")}</label><select id="edit-staff-role" name="role" value={role} onChange={event => setRole(event.target.value as "admin" | "staff")}><option value="staff" disabled={staff.isSelf}>{t("Staff")}</option><option value="admin">{t("Admin")}</option></select></div>
    <div className="form-field"><label htmlFor="edit-staff-status">{t("Status")}</label><select id="edit-staff-status" name="status" defaultValue={staff.status === "suspended" ? "suspended" : "active"}><option value="active">{t("Active")}</option><option value="suspended" disabled={staff.isSelf}>{t("Suspended")}</option></select></div>
    {staff.isSelf ? <p className="field-help form-span-2">{t("You cannot remove your own active administrator access")}</p> : null}
    {role === "staff" ? <><fieldset className="access-fieldset form-span-2"><legend>{t("Branch access")}</legend><div className="access-grid">{branches.map(branch => <label className="check-field" key={branch.id}><input type="checkbox" name="branchId" value={branch.id} defaultChecked={staff.branchIds.includes(branch.id)} /><span>{branch.city} · <bdi dir="ltr">{branch.code}</bdi></span></label>)}</div></fieldset>
    <details className="service-options form-span-2"><summary>{t("Capability grants")}</summary><div className="permission-grid">{permissions.map(permission => <label className="check-field" key={permission.code}><input type="checkbox" name="permissionCode" value={permission.code} defaultChecked={staff.permissionCodes.includes(permission.code)} /><span><strong>{t(permission.code.replaceAll(".", " "))}</strong><small>{t(permission.description)}</small></span></label>)}</div></details></> : <p className="field-help form-span-2">{t("Admin accounts automatically receive all branches and capabilities.")}</p>}
    <label className="check-field form-span-2"><input type="checkbox" name="isTechnician" defaultChecked={staff.isTechnician} /><span>{t("Available for technician assignments")}</span></label>
    <div className="form-field"><label htmlFor="edit-staff-employee">{t("Employee number")}</label><input id="edit-staff-employee" name="employeeNo" defaultValue={staff.employeeNo} maxLength={80} dir="ltr" /></div>
    <div className="form-field"><label htmlFor="edit-staff-grade">{t("Labor grade")}</label><input id="edit-staff-grade" name="laborGrade" defaultValue={staff.laborGrade} maxLength={80} /></div>
    {state.error ? <p className="text-danger form-span-2" role="alert">{t(state.error)}</p> : null}
    <div className="form-actions form-span-2"><Link className="button" href="/staff">{t("Cancel")}</Link><button className="button primary" disabled={pending}>{t(pending ? "Saving…" : "Save")}</button></div>
  </form>;
}

export function DeleteStaffForm({ membershipId, displayName }: { membershipId: string; displayName: string }) {
  const { pageText: t } = useUiLocale();
  const [confirmed, setConfirmed] = useState(false);
  const [state, action, pending] = useActionState(manageStaff, { error: "" });
  return <form action={action} className="form-grid panel-body">
    <input type="hidden" name="staffAction" value="delete" /><input type="hidden" name="membershipId" value={membershipId} />
    <p className="form-span-2"><strong>{displayName}</strong></p>
    <p className="field-help form-span-2">{t("Delete removes this person's access to this center and disables technician assignments. Work history is retained. Access can be restored from Deleted staff.")}</p>
    <label className="check-field form-span-2"><input type="checkbox" name="confirmDelete" required checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>{t("I confirm deleting this staff member's access.")}</span></label>
    {state.error ? <p role="alert" className="text-danger form-span-2">{t(state.error)}</p> : null}
    <div className="form-actions form-span-2"><Link className="button" href="/staff">{t("Cancel")}</Link><button className="button danger" disabled={!confirmed || pending}>{t(pending ? "Saving…" : "Delete")}</button></div>
  </form>;
}
