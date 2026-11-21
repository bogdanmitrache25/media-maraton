-- ---------------------------------------------------------------------------
-- 0010 — DETALLE DE ENTRENAMIENTO
--
-- Añade calorías, volumen y el detalle estructurado de ejercicios/series.
-- El texto libre sigue en `notes`; `exercises` es para auditoría y coach.
-- ---------------------------------------------------------------------------

alter table public.training_sessions
  add column if not exists calories_burned integer
    check (calories_burned is null or calories_burned between 0 and 5000);

alter table public.training_sessions
  add column if not exists volume_kg numeric(8,1)
    check (volume_kg is null or volume_kg between 0 and 100000);

alter table public.training_sessions
  add column if not exists exercises jsonb;

comment on column public.training_sessions.calories_burned is
  'Calorías activas del reloj para esta sesión. No se suman 1:1 a la comida.';

comment on column public.training_sessions.volume_kg is
  'Volumen total de la sesión en kg, tal como lo da Hevy.';

comment on column public.training_sessions.exercises is
  'Detalle estructurado: nombre, series, peso, repeticiones y RPE.';
