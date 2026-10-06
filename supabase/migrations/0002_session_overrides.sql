-- ---------------------------------------------------------------------------
-- 0002 · SUSTITUCIONES DE SESIÓN
--
-- El plan propone, pero no impone. Si un día toca bici y no apetece bici, el
-- atleta puede poner lo que realmente ha hecho. La fila original del plan no
-- se toca nunca: se guarda encima una capa de sustitución, de modo que
-- restaurar es tan simple como borrar la fila.
--
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- ---------------------------------------------------------------------------

create table if not exists public.session_overrides (
  user_id    uuid     not null references auth.users (id) on delete cascade,
  week       smallint not null check (week between 1 and 23),
  day        smallint not null check (day between 0 and 6),
  -- Qué ha hecho en su lugar. Obligatorio: una sustitución vacía no dice nada.
  title      text     not null check (char_length(title) between 1 and 80),
  note       text     check (note is null or char_length(note) <= 300),
  updated_at timestamptz not null default now(),
  primary key (user_id, week, day)
);

comment on table public.session_overrides is
  'Qué hace el atleta cuando sustituye una sesión del plan por otra cosa.';

create index if not exists session_overrides_user_idx
  on public.session_overrides (user_id);

drop trigger if exists session_overrides_touch on public.session_overrides;
create trigger session_overrides_touch
  before update on public.session_overrides
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Aislamiento: cada atleta ve y edita solo sus sustituciones.
-- ---------------------------------------------------------------------------
alter table public.session_overrides enable row level security;

drop policy if exists "overrides_select_own" on public.session_overrides;
create policy "overrides_select_own" on public.session_overrides
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "overrides_insert_own" on public.session_overrides;
create policy "overrides_insert_own" on public.session_overrides
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "overrides_update_own" on public.session_overrides;
create policy "overrides_update_own" on public.session_overrides
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "overrides_delete_own" on public.session_overrides;
create policy "overrides_delete_own" on public.session_overrides
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Defensa en profundidad: el rol anónimo ni lo intenta.
revoke all on public.session_overrides from anon;
grant select, insert, update, delete on public.session_overrides to authenticated;
