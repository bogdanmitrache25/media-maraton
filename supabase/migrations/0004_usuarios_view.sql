-- ---------------------------------------------------------------------------
-- 0004 · VISTA «QUIÉN ES QUIÉN»
--
-- En el editor de tablas `profiles` aparece un UUID y un nombre, pero no se
-- sabe de quién es cada fila. Esta vista une el perfil con su correo para poder
-- identificar a cada atleta de un vistazo.
--
-- SEGURIDAD — esto importa:
--   · `security_invoker = true` hace que la vista respete las políticas RLS de
--     las tablas de debajo. Sin eso, la vista se ejecutaría como su propietario
--     y **saltaría el RLS de auth.users**, dejando los correos de todos los
--     atletas al alcance de cualquier usuario autenticado.
--   · Además se retiran los permisos a `anon` y `authenticated`: la vista es
--     para el panel, no para la aplicación. La app no la necesita para nada.
--
-- Idempotente.
-- ---------------------------------------------------------------------------

create or replace view public.usuarios with (security_invoker = true) as
select
  p.id            as user_id,
  p.display_name,
  u.email,
  p.digest_enabled,
  p.created_at
from public.profiles p
join auth.users u on u.id = p.id;

comment on view public.usuarios is
  'Quién es quién: une el perfil con su correo. Solo para el panel.';

revoke all on public.usuarios from anon, authenticated;
