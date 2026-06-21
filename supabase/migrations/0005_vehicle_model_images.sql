-- ===== Admin-managed per-model vehicle images =====
-- Admin uploads one image per VW EV model (+ a default) under Settings; shown
-- for every vehicle of that model. Images live in a PUBLIC storage bucket; a
-- small table records which model maps to which uploaded file.

insert into storage.buckets (id, name, public)
values ('vehicle-models', 'vehicle-models', true)
on conflict (id) do nothing;

create table vehicle_model_images (
  model_key text primary key,
  storage_path text not null,
  updated_at timestamptz not null default now()
);
alter table vehicle_model_images enable row level security;

-- Any signed-in user reads (admin app + customer portal both show images); writes admin only.
create policy "vehicle_model_images select" on vehicle_model_images for select to authenticated
  using (true);
create policy "vehicle_model_images admin" on vehicle_model_images for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Storage policies for the public bucket: anyone may read; only admins write.
create policy "vehicle-models public read" on storage.objects for select
  using (bucket_id = 'vehicle-models');
create policy "vehicle-models admin write" on storage.objects for all to authenticated
  using (bucket_id = 'vehicle-models' and public.is_admin())
  with check (bucket_id = 'vehicle-models' and public.is_admin());

-- ===== Apply to prod with explicit authorization (like 0002–0004). =====
