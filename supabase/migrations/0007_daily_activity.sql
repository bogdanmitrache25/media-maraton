-- ---------------------------------------------------------------------------
-- 0007 — ACTIVIDAD DIARIA
--
-- Pasos, sueño y notas del día. El reloj es la fuente principal de pasos.
-- Una fila por usuario y día; el bot hace upsert.
-- ---------------------------------------------------------------------------

create table if not exists public.daily_activity (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  log_date    date not null default current_date,
  steps       integer check (steps between 0 and 100000),
  sleep_hours numeric(3,1) check (sleep_hours between 0 and 24),
  notes       text check (notes is null or char_length(notes) <= 300),
  created_at  timestamptz not null default now(),
  unique (user_id, log_date)
);

comment on table public.daily_activity is
  'Pasos, sueño y notas diarias. Una fila por usuario y día.';

create index if not exists daily_activity_user_date_idx
  on public.daily_activity (user_id, log_date desc);

alter table public.daily_activity enable row level security;

drop policy if exists "daily_activity_select_own" on public.daily_activity;
create policy "daily_activity_select_own" on public.daily_activity
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "daily_activity_insert_own" on public.daily_activity;
create policy "daily_activity_insert_own" on public.daily_activity
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "daily_activity_update_own" on public.daily_activity;
create policy "daily_activity_update_own" on public.daily_activity
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "daily_activity_delete_own" on public.daily_activity;
create policy "daily_activity_delete_own" on public.daily_activity
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.daily_activity from anon;
grant select, insert, update, delete on public.daily_activity to authenticated;
