-- ---------------------------------------------------------------------------
-- 0006 — PROGRESO CORPORAL, COMIDAS Y FOTOS
--
-- Todo queda ligado a auth.users y protegido por RLS: en la práctica solo hay
-- una cuenta (la del titular), pero el aislamiento se mantiene en el motor.
-- ---------------------------------------------------------------------------

create table if not exists public.body_metrics (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  measured_on    date not null default current_date,
  weight_kg      numeric(5,1) check (weight_kg between 30 and 250),
  body_fat_pct   numeric(4,1) check (body_fat_pct between 3 and 60),
  muscle_mass_kg numeric(5,1) check (muscle_mass_kg between 10 and 120),
  water_pct      numeric(4,1) check (water_pct between 20 and 75),
  visceral_fat   numeric(4,1) check (visceral_fat between 1 and 30),
  bone_mass_kg   numeric(4,1) check (bone_mass_kg between 1 and 10),
  bmr_kcal       integer check (bmr_kcal between 800 and 5000),
  waist_cm       numeric(5,1) check (waist_cm between 30 and 200),
  hip_cm         numeric(5,1) check (hip_cm between 30 and 200),
  chest_cm       numeric(5,1) check (chest_cm between 30 and 200),
  thigh_cm       numeric(5,1) check (thigh_cm between 20 and 120),
  arm_cm         numeric(5,1) check (arm_cm between 15 and 80),
  calf_cm        numeric(5,1) check (calf_cm between 20 and 80),
  notes          text check (notes is null or char_length(notes) <= 500),
  created_at     timestamptz not null default now(),
  unique (user_id, measured_on)
);

comment on table public.body_metrics is
  'Peso, composición corporal y medidas de cinta. Una fila por día.';

create index if not exists body_metrics_user_date_idx
  on public.body_metrics (user_id, measured_on desc);

create table if not exists public.meals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  eaten_at    timestamptz not null default now(),
  description text not null check (char_length(description) between 1 and 500),
  calories    integer check (calories between 0 and 10000),
  protein_g   numeric(5,1) check (protein_g between 0 and 500),
  carbs_g     numeric(5,1) check (carbs_g between 0 and 1000),
  fat_g       numeric(5,1) check (fat_g between 0 and 500),
  source      text not null default 'app' check (source in ('app', 'telegram')),
  created_at  timestamptz not null default now()
);

comment on table public.meals is
  'Registro de comidas. Los macros son estimaciones, no una verdad absoluta.';

create index if not exists meals_user_time_idx
  on public.meals (user_id, eaten_at desc);

create table if not exists public.progress_photos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  taken_on     date not null default current_date,
  view         text not null default 'front' check (view in ('front', 'side', 'back', 'other')),
  storage_path text not null unique,
  notes        text check (notes is null or char_length(notes) <= 300),
  created_at   timestamptz not null default now()
);

comment on table public.progress_photos is
  'Fotos privadas de progreso. El binario vive en el bucket privado progress.';

create index if not exists progress_photos_user_date_idx
  on public.progress_photos (user_id, taken_on desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.body_metrics    enable row level security;
alter table public.meals           enable row level security;
alter table public.progress_photos enable row level security;

drop policy if exists "body_metrics_select_own" on public.body_metrics;
create policy "body_metrics_select_own" on public.body_metrics
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "body_metrics_insert_own" on public.body_metrics;
create policy "body_metrics_insert_own" on public.body_metrics
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "body_metrics_update_own" on public.body_metrics;
create policy "body_metrics_update_own" on public.body_metrics
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "body_metrics_delete_own" on public.body_metrics;
create policy "body_metrics_delete_own" on public.body_metrics
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "meals_select_own" on public.meals;
create policy "meals_select_own" on public.meals
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "meals_insert_own" on public.meals;
create policy "meals_insert_own" on public.meals
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "meals_update_own" on public.meals;
create policy "meals_update_own" on public.meals
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "meals_delete_own" on public.meals;
create policy "meals_delete_own" on public.meals
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "progress_photos_select_own" on public.progress_photos;
create policy "progress_photos_select_own" on public.progress_photos
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "progress_photos_insert_own" on public.progress_photos;
create policy "progress_photos_insert_own" on public.progress_photos
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "progress_photos_update_own" on public.progress_photos;
create policy "progress_photos_update_own" on public.progress_photos
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "progress_photos_delete_own" on public.progress_photos;
create policy "progress_photos_delete_own" on public.progress_photos
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.body_metrics    from anon;
revoke all on public.meals           from anon;
revoke all on public.progress_photos from anon;

grant select, insert, update, delete on public.body_metrics    to authenticated;
grant select, insert, update, delete on public.meals           to authenticated;
grant select, insert, update, delete on public.progress_photos to authenticated;

-- ---------------------------------------------------------------------------
-- Bucket privado para las fotos. Vive en el Supabase self-hosted del servidor.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('progress', 'progress', false)
on conflict (id) do nothing;

drop policy if exists "progress_storage_select_own" on storage.objects;
create policy "progress_storage_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'progress'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "progress_storage_insert_own" on storage.objects;
create policy "progress_storage_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'progress'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "progress_storage_update_own" on storage.objects;
create policy "progress_storage_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'progress'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'progress'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "progress_storage_delete_own" on storage.objects;
create policy "progress_storage_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'progress'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
