-- Access hardening only; no business rows are modified.
-- Approved by the user on 2026-09-08 after integration and ACL checks.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;

-- Evaluate the signed-in identity once, retaining identical row visibility.
alter policy portal_payment_requests_select on public.portal_payment_requests
using (app_private.has_branch_access(organization_id, branch_id) or exists (
  select 1 from public.customer_accounts a
  where a.organization_id = portal_payment_requests.organization_id
    and a.customer_id = portal_payment_requests.customer_id
    and a.auth_user_id = (select auth.uid()) and a.status = 'active'
));
