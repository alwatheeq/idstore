# IDstore database setup

## 1. Create or select the Supabase project

Use a dedicated project named `IDstore`. For the Jordan launch, `eu-central-1` is the recommended default pending a measured latency and data-residency decision. Do not deploy into an unrelated existing project.

The project uses Postgres 17. New public tables are not auto-exposed; the migration grants only the access needed by the application.

## 2. Apply migrations

Preferred automated path:

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
npx supabase migration list
npx supabase functions deploy provision-staff
```

The repository migration is also applied through the authenticated Supabase connector during provisioning. Do not apply the same migration twice under different names.

## 3. Create the first Auth user

Internal users sign in with an E.164 mobile number and a six-digit PIN. Until a dedicated phone-auth provider is introduced, the server maps the normalized number to an internal Auth email alias in the form `<digits>@mobile.idstore.invalid` and uses the PIN as the Auth password. Create that alias in Supabase Auth, mark it verified, set the six-digit PIN, and obtain the user's UUID from Auth administration. Never put a mobile number, PIN or Auth UUID in a migration or commit it to Git.

Six-digit PINs are low entropy. Before production rollout, add rate limiting and a stronger second factor or replace this bridge with verified phone OTP authentication.

## 4. Bootstrap the organization and first Admin

Run the following once in the SQL editor, replacing only the marked values. This is deployment data, not schema migration data.

```sql
begin;

with new_org as (
  insert into public.organizations (
    legal_name, display_name, tax_number, base_currency, default_locale
  ) values (
    '<LEGAL_NAME>', '<DISPLAY_NAME>', '<TAX_NUMBER_OR_NULL>', 'JOD', 'ar-JO'
  )
  returning id
), new_profile as (
  insert into public.profiles (user_id, display_name, locale)
  values ('<AUTH_USER_UUID>'::uuid, '<ADMIN_NAME>', 'ar-JO')
  on conflict (user_id) do update set display_name = excluded.display_name
  returning user_id
)
insert into public.memberships (organization_id, user_id, role, all_branches, status)
select new_org.id, new_profile.user_id, 'admin', true, 'active'
from new_org cross join new_profile;

commit;
```

Create branches after the Admin membership exists. Each active branch requires city, address, time zone, currency and tax configuration. Staff memberships use `role = 'staff'`, receive rows in `membership_branches`, and receive only the required `membership_permissions`.

After the first Admin exists, additional Admin and Staff accounts are provisioned from **Staff and access**. The authenticated `provision-staff` Edge Function creates the Auth identity, then calls the transactional database command for the profile, membership, branch assignments and capability grants. JWT verification must remain enabled; the service-role key is used only inside the hosted function and must never be added to the Next.js environment.

## 5. Storage

The migration creates private buckets for vehicle media, diagnostics, documents, qualification evidence and integration payloads. User-accessible object names start with the organization UUID:

```text
vehicle-media/{organization_id}/{vehicle_id}/{repair_order_id}/{immutable-file-name}
documents/{organization_id}/{document_type}/{document_id}/{immutable-file-name}
```

Integration payloads are server-only. Do not grant browser access to that bucket.

## 6. Verification

Execute `supabase/tests/schema_verification.sql` against the linked project. Then run both Supabase advisors and review every finding before application rollout. The authenticated `SECURITY DEFINER` command functions are intentional API boundaries: each must retain explicit in-function authorization checks, a fixed `search_path`, and revoked access for `PUBLIC` and `anon`.

Required manual checks:

1. Admin can read every assigned organization branch.
2. Staff cannot read an unassigned branch.
3. A user with no membership cannot read organization data.
4. Customer portal users are not internal Admin/Staff members.
5. Posted stock movements cannot be updated or deleted.
6. Stock movements cannot withdraw more than the available balance.
7. Only the assigned technician can run a job timer, and job completion closes the timer after its start time.
8. High-voltage job completion is blocked until its permit is closed or revoked.
9. Objects outside the caller's organization path cannot be read or uploaded.

## 7. Secrets

Browser applications receive only the project URL and publishable key. Database passwords, secret keys, payment credentials, messaging credentials and JoFotara credentials belong in approved server-side secret storage. Never store raw secrets in `integration.connections.config_json`.
