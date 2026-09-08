# Staff management

Admins use Staff → Edit to change the display name, Admin/Staff role, account status, branch access, capabilities, and technician availability/employee details. The login mobile and PIN are not changed by this form.

Delete requires a separate confirmation screen. It revokes the organization membership, clears its grants and branches, and disables its technician profile. It does not erase the Auth identity, profiles, work history or audit evidence. Deleted staff are hidden from the ordinary roster and can be restored through Deleted staff → Restore with fresh access assignments.

The transactional manage_staff RPC rechecks active admin authority and organization ownership. An organization-row lock serializes concurrent role/removal operations with the existing Settings access RPC. Self-removal/demotion and removal of the final active administrator are rejected. Revocation denies organization permissions even to an existing authenticated token because authorization reads active database memberships; identities shared with other organizations are not globally suspended.

Verification: SQL rollback tests cover profile edits, promotion/demotion, deletion, restoration, self-protection, staff denial and existing-token permission revocation. Browser fixtures cover Arabic/English mobile layouts and confirmation defaults. Server action fixtures cover authorization, validation, branch/permission payloads, confirmation and recoverable failures. No live staff records were changed by testing.
