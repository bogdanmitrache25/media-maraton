-- ---------------------------------------------------------------------------
-- 0005 · VISTAS DE LECTURA CON NOMBRES
--
-- En el editor de tablas, `session_completions`, `session_overrides` y
-- `weekly_logs` guardan un `user_id` en crudo: un UUID que no dice de quién es.
-- Estas vistas añaden el nombre y el correo para poder revisar quién ha hecho
-- qué sin tener que cruzar UUID a mano.
--
-- Son solo de lectura y para el panel: la aplicación no las usa y no puede
-- leerlas (ver los permisos del final). Todo lo que hay aquí es exactamente lo
-- que el dueño del proyecto ya ve en el panel; lo que se protege es que un
-- atleta cualquiera no pueda listar los datos de los demás.
--
-- Idempotente.
-- ---------------------------------------------------------------------------

-- Etiqueta legible del día: "S01 · Jue" en lugar de "1, 3".
create or replace view public.sesiones_hechas with (security_invoker = true) as
select
  p.display_name,
  u.email,
  c.week,
  c.day,
  'S' || lpad(c.week::text, 2, '0') || ' · '
    || (array['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'])[c.day + 1] as cuando,
  c.done_at
from public.session_completions c
join public.profiles p on p.id = c.user_id
join auth.users u on u.id = c.user_id
order by c.week, c.day;

comment on view public.sesiones_hechas is 'Sesiones marcadas, con nombre y correo.';

create or replace view public.sustituciones with (security_invoker = true) as
select
  p.display_name,
  u.email,
  o.week,
  o.day,
  'S' || lpad(o.week::text, 2, '0') || ' · '
    || (array['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'])[o.day + 1] as cuando,
  o.title as sustitucion,
  o.note as nota,
  o.updated_at
from public.session_overrides o
join public.profiles p on p.id = o.user_id
join auth.users u on u.id = o.user_id
order by o.week, o.day;

comment on view public.sustituciones is 'Sesiones sustituidas, con nombre y correo.';

create or replace view public.registros_semanales with (security_invoker = true) as
select
  p.display_name,
  u.email,
  l.week,
  l.km,
  l.pain,
  l.cadence,
  l.sleep,
  l.palp_d as tibia_d,
  l.palp_i as tibia_i,
  l.acwr,
  l.notes,
  l.updated_at
from public.weekly_logs l
join public.profiles p on p.id = l.user_id
join auth.users u on u.id = l.user_id
order by l.week;

comment on view public.registros_semanales is 'Cierres semanales, con nombre y correo.';

-- Solo para el panel. Ni la app ni un anónimo deben poder listarlas.
revoke all on public.sesiones_hechas    from anon, authenticated;
revoke all on public.sustituciones      from anon, authenticated;
revoke all on public.registros_semanales from anon, authenticated;
