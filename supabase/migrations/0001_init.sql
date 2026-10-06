-- ============================================================================
--  media-maraton · Esquema inicial
--  Ejecutar en: Supabase Dashboard → SQL Editor → New query → Run
--  Es idempotente: se puede ejecutar varias veces sin romper nada.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. PERFILES
--    Extiende auth.users (que gestiona Supabase) con datos públicos.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 80),
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.profiles is 'Datos públicos del usuario. Una fila por cuenta.';

-- ---------------------------------------------------------------------------
-- 2. SESIONES COMPLETADAS
--    Una fila por (usuario, semana, día) marcado como hecho.
-- ---------------------------------------------------------------------------
create table if not exists public.session_completions (
  user_id uuid    not null references auth.users (id) on delete cascade,
  week    smallint not null check (week between 1 and 23),
  day     smallint not null check (day between 0 and 6),
  done_at timestamptz not null default now(),
  primary key (user_id, week, day)
);

comment on table public.session_completions is 'Casillas marcadas en el calendario de 23 semanas.';

create index if not exists session_completions_user_idx
  on public.session_completions (user_id);

-- ---------------------------------------------------------------------------
-- 3. REGISTROS SEMANALES
--    Cierre de semana: km, dolor, cadencia, sueño, palpación tibial, ACWR.
-- ---------------------------------------------------------------------------
create table if not exists public.weekly_logs (
  user_id    uuid     not null references auth.users (id) on delete cascade,
  week       smallint not null check (week between 1 and 23),
  km         numeric(6,2) check (km between 0 and 400),
  pain       smallint check (pain between 0 and 10),
  cadence    smallint check (cadence between 100 and 260),
  sleep      numeric(3,1) check (sleep between 0 and 14),
  palp_d     numeric(4,1) check (palp_d between 0 and 40),
  palp_i     numeric(4,1) check (palp_i between 0 and 40),
  acwr       numeric(4,2) check (acwr between 0 and 10),
  notes      text check (char_length(notes) <= 500),
  updated_at timestamptz not null default now(),
  primary key (user_id, week)
);

comment on table public.weekly_logs is 'Cierre semanal del atleta: carga, dolor y señales de alarma.';

-- ---------------------------------------------------------------------------
-- 4. RATE LIMITING (ventana fija)
--    Solo accesible por la función de abajo (service_role).
-- ---------------------------------------------------------------------------
create table if not exists public.rate_limits (
  bucket   text primary key,
  count    integer not null default 0,
  reset_at timestamptz not null
);

comment on table public.rate_limits is 'Contadores de rate limiting. No contiene datos personales.';

-- ---------------------------------------------------------------------------
-- 5. FUNCIONES Y TRIGGERS
-- ---------------------------------------------------------------------------

-- 5.1 Crear el perfil automáticamente al registrarse.
--     SECURITY DEFINER + search_path vacío: evita ataques de search_path.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      left(new.raw_user_meta_data ->> 'full_name',
           case when new.raw_user_meta_data ? 'full_name' then 80 else 0 end),
      left(new.raw_user_meta_data ->> 'name', 80),
      left(split_part(coalesce(new.email, ''), '@', 1), 80),
      'Atleta'
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5.2 Mantener updated_at al día.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists weekly_logs_touch on public.weekly_logs;
create trigger weekly_logs_touch
  before update on public.weekly_logs
  for each row execute function public.touch_updated_at();

-- 5.3 Consumir una unidad de rate limit.
--     Devuelve true si la petición está permitida.
create or replace function public.rate_limit_hit(
  p_bucket         text,
  p_limit          integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now   timestamptz := now();
  v_count integer;
begin
  insert into public.rate_limits (bucket, count, reset_at)
  values (p_bucket, 1, v_now + make_interval(secs => p_window_seconds))
  on conflict (bucket) do update
    set count    = case when public.rate_limits.reset_at < v_now
                        then 1 else public.rate_limits.count + 1 end,
        reset_at = case when public.rate_limits.reset_at < v_now
                        then v_now + make_interval(secs => p_window_seconds)
                        else public.rate_limits.reset_at end
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

-- Limpieza oportunista de contadores caducados.
create or replace function public.rate_limit_gc()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.rate_limits where reset_at < now() - interval '1 hour';
$$;

-- ---------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY
--    A partir de aquí, ni aunque se filtre la anon key se puede ver
--    o tocar datos de otro usuario. El aislamiento vive en el motor.
-- ---------------------------------------------------------------------------
alter table public.profiles             enable row level security;
alter table public.session_completions  enable row level security;
alter table public.weekly_logs          enable row level security;
alter table public.rate_limits          enable row level security;

-- 6.1 profiles: cada uno ve y edita solo el suyo.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Sin policy de INSERT: el perfil lo crea el trigger (security definer).
-- Sin policy de DELETE: se borra en cascada con la cuenta.

-- 6.2 session_completions: aislamiento total por usuario.
drop policy if exists "sessions_select_own" on public.session_completions;
create policy "sessions_select_own" on public.session_completions
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "sessions_insert_own" on public.session_completions;
create policy "sessions_insert_own" on public.session_completions
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "sessions_delete_own" on public.session_completions;
create policy "sessions_delete_own" on public.session_completions
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Sin policy de UPDATE: una sesión o está hecha o no lo está.

-- 6.3 weekly_logs: aislamiento total por usuario.
drop policy if exists "logs_select_own" on public.weekly_logs;
create policy "logs_select_own" on public.weekly_logs
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "logs_insert_own" on public.weekly_logs;
create policy "logs_insert_own" on public.weekly_logs
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "logs_update_own" on public.weekly_logs;
create policy "logs_update_own" on public.weekly_logs
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "logs_delete_own" on public.weekly_logs;
create policy "logs_delete_own" on public.weekly_logs
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- 6.4 rate_limits: sin policies → nadie salvo service_role (que ignora RLS).

-- ---------------------------------------------------------------------------
-- 7. PERMISOS
--    Defensa en profundidad: aunque RLS ya bloquea, retiramos los GRANT.
--    El rol `anon` (no autenticado) no debe poder ni intentarlo.
-- ---------------------------------------------------------------------------
revoke all on public.profiles            from anon;
revoke all on public.session_completions from anon;
revoke all on public.weekly_logs         from anon;
revoke all on public.rate_limits         from anon, authenticated;

revoke all on function public.rate_limit_hit(text, integer, integer) from anon, authenticated;
revoke all on function public.rate_limit_gc()                        from anon, authenticated;

grant select, insert, update, delete on public.session_completions to authenticated;
grant select, insert, update, delete on public.weekly_logs         to authenticated;
grant select, update                 on public.profiles            to authenticated;
