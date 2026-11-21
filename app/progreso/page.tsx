import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClientWithUser } from '@/lib/supabase/server';
import {
  ProgressApp,
  type BodyMetricRow,
  type MealRow,
  type PhotoRow,
} from '@/components/ProgressApp';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Progreso · Media Maratón 1:55',
};

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; photoPage?: string }>;
}) {
  const params = await searchParams;
  const photoPage = Math.max(1, Number.parseInt(params.photoPage ?? '1', 10) || 1);
  const photoPageSize = 24;
  const photoFrom = (photoPage - 1) * photoPageSize;

  const { supabase, user } = await createClientWithUser();
  if (!user) redirect('/login');

  const [metricsRes, mealsRes, photosRes, profileRes] = await Promise.all([
    supabase
      .from('body_metrics')
      .select(
        'id, measured_on, weight_kg, body_fat_pct, muscle_mass_kg, water_pct, visceral_fat, bone_mass_kg, bmr_kcal, waist_cm, hip_cm, chest_cm, thigh_cm, arm_cm, calf_cm, notes',
      )
      .eq('user_id', user.id)
      .order('measured_on', { ascending: false })
      .limit(60),
    supabase
      .from('meals')
      .select('id, eaten_at, description, calories, protein_g, carbs_g, fat_g, source')
      .eq('user_id', user.id)
      .order('eaten_at', { ascending: false })
      .limit(80),
    supabase
      .from('progress_photos')
      .select('id, taken_on, view, storage_path, notes')
      .eq('user_id', user.id)
      .order('taken_on', { ascending: false })
      .range(photoFrom, photoFrom + photoPageSize),
    supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle(),
  ]);

  const metrics: BodyMetricRow[] = (metricsRes.data ?? []).map((r) => ({
    id: r.id,
    measuredOn: r.measured_on,
    weightKg: r.weight_kg,
    bodyFatPct: r.body_fat_pct,
    muscleMassKg: r.muscle_mass_kg,
    waterPct: r.water_pct,
    visceralFat: r.visceral_fat,
    boneMassKg: r.bone_mass_kg,
    bmrKcal: r.bmr_kcal,
    waistCm: r.waist_cm,
    hipCm: r.hip_cm,
    chestCm: r.chest_cm,
    thighCm: r.thigh_cm,
    armCm: r.arm_cm,
    calfCm: r.calf_cm,
    notes: r.notes,
  }));

  const meals: MealRow[] = (mealsRes.data ?? []).map((r) => ({
    id: r.id,
    eatenAt: r.eaten_at,
    description: r.description,
    calories: r.calories,
    proteinG: r.protein_g,
    carbsG: r.carbs_g,
    fatG: r.fat_g,
    source: r.source,
  }));

  const photoRows = (photosRes.data ?? []).slice(0, photoPageSize);
  const hasMorePhotos = (photosRes.data ?? []).length > photoPageSize;
  const photos: PhotoRow[] = await Promise.all(
    photoRows.map(async (r) => {
      const { data } = await supabase.storage
        .from('progress')
        .createSignedUrl(r.storage_path, 60 * 60 * 24 * 7);
      return {
        id: r.id,
        takenOn: r.taken_on,
        view: r.view,
        notes: r.notes,
        url: data?.signedUrl ?? null,
      };
    }),
  );

  return (
    <ProgressApp
      name={profileRes.data?.display_name || user.email?.split('@')[0] || 'Bogdan'}
      today={new Date().toISOString().slice(0, 10)}
      initialMetrics={metrics}
      initialMeals={meals}
      initialPhotos={photos}
      initialTab={params.tab === 'fotos' ? 'fotos' : 'resumen'}
      photoPage={photoPage}
      hasMorePhotos={hasMorePhotos}
    />
  );
}
