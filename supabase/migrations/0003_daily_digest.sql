-- ---------------------------------------------------------------------------
-- 0003 · CORREO DIARIO CON EL PLAN DEL DÍA
--
-- Preferencia por usuario: cada atleta decide si quiere recibir el correo de
-- las 5:30 con la sesión que le toca. Por defecto NO: la app es multiusuario
-- y nadie debe recibir correo sin haberlo pedido.
--
-- `digest_sent_on` es el pestillo de idempotencia. El cron puede dispararse dos
-- veces al día (una por cada horario, verano e invierno) y solo debe enviar una.
--
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists digest_enabled boolean not null default false;

alter table public.profiles
  add column if not exists digest_sent_on date;

comment on column public.profiles.digest_enabled is
  'Si el atleta quiere recibir el plan del día por correo a las 5:30 (Europe/Madrid).';

comment on column public.profiles.digest_sent_on is
  'Último día (Europe/Madrid) en que se le envió el correo. Evita duplicados.';

-- El cron busca solo a quien lo tiene activado, así que este índice mantiene la
-- consulta barata aunque la tabla crezca.
create index if not exists profiles_digest_idx
  on public.profiles (digest_enabled)
  where digest_enabled;
