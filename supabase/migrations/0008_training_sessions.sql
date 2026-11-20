-- ---------------------------------------------------------------------------
-- 0008 — SESIONES DE ENTRENAMIENTO
--
-- Registro básico de sesiones de fuerza/carrera. De momento guardamos el texto
-- que manda el atleta por Telegram; más adelante se puede estructurar por
-- ejercicios y series sin perder este histórico.
-- ---------------------------------------------------------------------------

create table if not exists public.training_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  session_date date not null default current_date,
  kind         text not null default 'other' check (kind in ('push', 'pull', 'legs', 'run', 'other')),
  duration_min integer check (duration_min between 0 and 600),
  rpe          numeric(3,1) check (rpe between 1 and 10),
  notes        text check (notes is null or char_length(notes) <= 2000),
  source       text not null default 'telegram' check (source in ('app', 'telegram')),
  created_at   timestamptz not null default now()
);

comment on table public.training_sessions is
  'Sesiones de entrenamiento. El texto libre se guarda en notes.';

create index if not exists training_sessions_user_date_idx
  on public.training_sessions (user_id, session_date desc);

alter table public.training_sessions enable row level security;

drop policy if exists "training_sessions_select_own" on public.training_sessions;
create policy "training_sessions_select_own" on public.training_sessions
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "training_sessions_insert_own" on public.training_sessions;
create policy "training_sessions_insert_own" on public.training_sessions
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "training_sessions_update_own" on public.training_sessions;
create policy "training_sessions_update_own" on public.training_sessions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "training_sessions_delete_own" on public.training_sessions;
create policy "training_sessions_delete_own" on public.training_sessions
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.training_sessions from anon;
grant select, insert, update, delete on public.training_sessions to authenticated;
