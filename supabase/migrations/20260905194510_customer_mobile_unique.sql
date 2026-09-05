-- Enforce mobile number uniqueness for customer records.
-- Mobile numbers are used as the lookup key for customer portal login.

create unique index if not exists customer_contacts_mobile_organization_unique
  on public.customer_contacts (organization_id, normalized_value)
  where kind = 'mobile';
