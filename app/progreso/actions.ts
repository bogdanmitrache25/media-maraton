'use server';

import { revalidatePath } from 'next/cache';
import { createClientWithUser } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
import { bodyMetricSchema, mealSchema, toNumberOrNull } from '@/lib/validation';

export type ActionResult = { ok: true } | { ok: false; error: string };

const GENERIC_ERROR = 'No se pudo guardar. Inténtalo de nuevo.';
const RATE_LIMIT_ERROR = 'Demasiadas peticiones seguidas. Espera unos segundos.';

/** Guarda o actualiza la medición corporal del día. */
export async function saveBodyMetric(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await createClientWithUser();
  if (!user) return { ok: false, error: 'Tu sesión ha caducado. Vuelve a entrar.' };

  const measuredOn = String(formData.get('measuredOn') ?? '').trim();
  const parsed = bodyMetricSchema.safeParse({
    measuredOn,
    weightKg: toNumberOrNull(formData.get('weightKg')),
    bodyFatPct: toNumberOrNull(formData.get('bodyFatPct')),
    muscleMassKg: toNumberOrNull(formData.get('muscleMassKg')),
    waterPct: toNumberOrNull(formData.get('waterPct')),
    visceralFat: toNumberOrNull(formData.get('visceralFat')),
    boneMassKg: toNumberOrNull(formData.get('boneMassKg')),
    bmrKcal: toNumberOrNull(formData.get('bmrKcal')),
    waistCm: toNumberOrNull(formData.get('waistCm')),
    hipCm: toNumberOrNull(formData.get('hipCm')),
    chestCm: toNumberOrNull(formData.get('chestCm')),
    thighCm: toNumberOrNull(formData.get('thighCm')),
    armCm: toNumberOrNull(formData.get('armCm')),
    calfCm: toNumberOrNull(formData.get('calfCm')),
    notes: String(formData.get('notes') ?? '').trim() || null,
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first ? `Revisa el campo: ${first.message}` : 'Datos no válidos.' };
  }

  if (!(await rateLimit(`metric:${user.id}`, 60, 60))) {
    return { ok: false, error: RATE_LIMIT_ERROR };
  }

  const p = parsed.data;
  const { error } = await supabase.from('body_metrics').upsert(
    {
      user_id: user.id,
      measured_on: p.measuredOn,
      weight_kg: p.weightKg,
      body_fat_pct: p.bodyFatPct,
      muscle_mass_kg: p.muscleMassKg,
      water_pct: p.waterPct,
      visceral_fat: p.visceralFat,
      bone_mass_kg: p.boneMassKg,
      bmr_kcal: p.bmrKcal,
      waist_cm: p.waistCm,
      hip_cm: p.hipCm,
      chest_cm: p.chestCm,
      thigh_cm: p.thighCm,
      arm_cm: p.armCm,
      calf_cm: p.calfCm,
      notes: p.notes,
    },
    { onConflict: 'user_id,measured_on' },
  );

  if (error) {
    console.error('[saveBodyMetric]', error.message);
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath('/progreso');
  return { ok: true };
}

/** Registra una comida. */
export async function saveMeal(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await createClientWithUser();
  if (!user) return { ok: false, error: 'Tu sesión ha caducado. Vuelve a entrar.' };

  const rawDate = String(formData.get('eatenAt') ?? '').trim();
  const date = rawDate ? new Date(rawDate) : new Date();
  if (Number.isNaN(date.getTime())) return { ok: false, error: 'La fecha no es válida.' };

  const parsed = mealSchema.safeParse({
    eatenAt: date.toISOString(),
    description: String(formData.get('description') ?? '').trim(),
    calories: toNumberOrNull(formData.get('calories')),
    proteinG: toNumberOrNull(formData.get('proteinG')),
    carbsG: toNumberOrNull(formData.get('carbsG')),
    fatG: toNumberOrNull(formData.get('fatG')),
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first ? first.message : 'Datos no válidos.' };
  }

  if (!(await rateLimit(`meal:${user.id}`, 120, 60))) {
    return { ok: false, error: RATE_LIMIT_ERROR };
  }

  const m = parsed.data;
  const { error } = await supabase.from('meals').insert({
    user_id: user.id,
    eaten_at: m.eatenAt,
    description: m.description,
    calories: m.calories,
    protein_g: m.proteinG,
    carbs_g: m.carbsG,
    fat_g: m.fatG,
    source: 'app',
  });

  if (error) {
    console.error('[saveMeal]', error.message);
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath('/progreso');
  return { ok: true };
}

/** Borra una comida propia. */
export async function deleteMeal(id: string): Promise<ActionResult> {
  const { supabase, user } = await createClientWithUser();
  if (!user) return { ok: false, error: 'Tu sesión ha caducado. Vuelve a entrar.' };
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: 'Comida no válida.' };

  if (!(await rateLimit(`meal-del:${user.id}`, 60, 60))) {
    return { ok: false, error: RATE_LIMIT_ERROR };
  }

  const { error } = await supabase.from('meals').delete().eq('id', id).eq('user_id', user.id);
  if (error) {
    console.error('[deleteMeal]', error.message);
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath('/progreso');
  return { ok: true };
}
