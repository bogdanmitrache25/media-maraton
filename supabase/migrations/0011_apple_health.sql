-- ---------------------------------------------------------------------------
-- 0011 — APPLE HEALTH / HEALTHKIT
--
-- Ingesta de Salud de Apple: pasos, energía activa, basal, distancia y
-- entrenos. La energía activa de Apple incluye los entrenos; el balance del
-- bot debe usar BMR + active_kcal y NO sumar otra vez las calorías del entreno.
-- ---------------------------------------------------------------------------

alter table public.daily_activity
  add column if not exists active_kcal integer
    check (active_kcal is null or active_kcal between 0 and 20000);
alter table public.daily_activity
  add column if not exists basal_kcal integer
    check (basal_kcal is null or basal_kcal between 0 and 20000);
alter table public.daily_activity
  add column if not exists distance_km numeric(6,2)
    check (distance_km is null or distance_km between 0 and 500);
alter table public.daily_activity
  add column if not exists source text not null default 'manual';

comment on column public.daily_activity.active_kcal is
  'Energía activa del día según Apple Health; incluye entrenos y pasos.';

alter table public.training_sessions
  add column if not exists external_id text;
alter table public.training_sessions
  add column if not exists started_at timestamptz;
alter table public.training_sessions
  add column if not exists ended_at timestamptz;
alter table public.training_sessions
  add column if not exists distance_km numeric(6,2)
    check (distance_km is null or distance_km between 0 and 500);
alter table public.training_sessions
  add column if not exists avg_hr integer
    check (avg_hr is null or avg_hr between 20 and 250);
alter table public.training_sessions
  add column if not exists max_hr integer
    check (max_hr is null or max_hr between 20 and 250);

alter table public.training_sessions
  drop constraint if exists training_sessions_source_check;
alter table public.training_sessions
  add constraint training_sessions_source_check
  check (source in ('app', 'telegram', 'apple'));

create unique index if not exists training_sessions_apple_external_idx
  on public.training_sessions (user_id, source, external_id);

comment on column public.training_sessions.external_id is
  'ID estable del entreno en Apple Health para no duplicarlo en cada export.';

create table if not exists public.health_imports (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  source      text not null default 'apple',
  received_at timestamptz not null default now(),
  payload     jsonb not null,
  headers     jsonb,
  processed   boolean not null default false
);

create index if not exists health_imports_user_received_idx
  on public.health_imports (user_id, received_at desc);

alter table public.health_imports enable row level security;
revoke all on public.health_imports from anon, authenticated;

create table if not exists public.health_sync_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  label       text not null default 'apple-health',
  token_hash  text not null unique,
  created_at  timestamptz not null default now(),
  last_used_at timestamptz
);

alter table public.health_sync_tokens enable row level security;
revoke all on public.health_sync_tokens from anon, authenticated;
