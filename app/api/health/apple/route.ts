import { createHash } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AnyRecord = Record<string, any>;

const DAY_RE = /(\d{4}-\d{2}-\d{2})/;

function tokenFrom(request: Request): string | null {
  const auth = request.headers.get('authorization') ?? '';
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim() || null;
  return (
    request.headers.get('x-health-token')?.trim() ||
    new URL(request.url).searchParams.get('token')?.trim() ||
    null
  );
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function numberFrom(value: unknown): number | null {
  if (value === null || value === undefined || typeof value === 'boolean') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  if (typeof value === 'object') {
    const object = value as AnyRecord;
    return (
      numberFrom(object.qty) ??
      numberFrom(object.value) ??
      numberFrom(object.quantity) ??
      numberFrom(object.doubleValue) ??
      numberFrom(object.amount)
    );
  }
  const number = Number(String(value).replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

function dateKey(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const match = String(value).match(DAY_RE);
  return match?.[1] ?? null;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoDate(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function kmFrom(value: unknown, units: unknown): number | null {
  const number = numberFrom(value);
  if (number === null) return null;
  const unit = String(units ?? '').toLowerCase();
  if (unit.includes('mi')) return number * 1.609344;
  if (unit === 'm' || unit.includes('meter')) return number / 1000;
  return number;
}

function kcalFrom(value: unknown, units: unknown): number | null {
  const number = numberFrom(value);
  if (number === null) return null;
  const unit = String(units ?? '').toLowerCase();
  if (unit.includes('kj')) return number / 4.184;
  return number;
}

function durationMinutes(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.includes(':')) {
    const parts = value.split(':').map(Number);
    if (parts.every(Number.isFinite)) {
      const [hours = 0, minutes = 0, seconds = 0] = parts;
      if (parts.length === 3) return Math.round(hours * 60 + minutes + seconds / 60);
      if (parts.length === 2) return Math.round(hours + minutes / 60);
    }
  }
  const number = numberFrom(value);
  if (number === null) return null;
  return Math.round(number > 300 ? number / 60 : number);
}

function metricName(metric: AnyRecord): string {
  return String(
    metric.name ?? metric.metric ?? metric.type ?? metric.identifier ?? '',
  )
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function metricSamples(metric: AnyRecord): AnyRecord[] {
  const samples = metric.data ?? metric.samples ?? metric.values ?? metric.points;
  if (Array.isArray(samples)) return samples as AnyRecord[];
  if (samples && typeof samples === 'object') return [samples as AnyRecord];
  return [];
}

function metricCollection(payload: AnyRecord): AnyRecord[] {
  const data = payload.data;
  if (Array.isArray(payload.metrics)) return payload.metrics;
  if (data && Array.isArray(data.metrics)) return data.metrics;
  if (Array.isArray(data)) return data;
  return [];
}

function workoutCollection(payload: AnyRecord): AnyRecord[] {
  const data = payload.data;
  if (Array.isArray(payload.workouts)) return payload.workouts;
  if (data && Array.isArray(data.workouts)) return data.workouts;
  if (Array.isArray(payload.workout)) return payload.workout;
  if (data && Array.isArray(data.workout)) return data.workout;
  return [];
}

function workoutName(workout: AnyRecord): string {
  return String(
    workout.name ??
      workout.activityType ??
      workout.workoutActivityType ??
      workout.type ??
      'Entreno Apple',
  ).trim();
}

function workoutKind(name: string): 'run' | 'other' {
  const low = name.toLowerCase();
  return /run|carrera|correr|running|trail/.test(low) ? 'run' : 'other';
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const payload: AnyRecord = {
    date: params.get('date') ?? todayKey(),
    steps: params.get('steps'),
    active_kcal: params.get('active_kcal'),
    basal_kcal: params.get('basal_kcal'),
    distance_km: params.get('distance_km'),
    workouts: [],
  };
  const headers = new Headers();
  const auth = request.headers.get('authorization');
  if (auth) headers.set('authorization', auth);
  headers.set('content-type', 'application/json');
  const synthetic = new Request(request.url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return POST(synthetic);
}

export async function POST(request: Request) {
  const token = tokenFrom(request);
  if (!token) {
    return Response.json({ error: 'Falta token.' }, { status: 401 });
  }

  const admin = createAdminClient();
  const tokenHash = sha256(token);
  const tokenRow = await admin
    .from('health_sync_tokens')
    .select('id, user_id')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (!tokenRow.data) {
    return Response.json({ error: 'Token no válido.' }, { status: 401 });
  }

  const userId = tokenRow.data.user_id as string;
  await admin
    .from('health_sync_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', tokenRow.data.id);

  let payload: AnyRecord;
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return Response.json({ error: 'JSON no válido.' }, { status: 400 });
    }
    payload = body as AnyRecord;
  } catch {
    return Response.json({ error: 'JSON no válido.' }, { status: 400 });
  }

  const received = await admin.from('health_imports').insert({
    user_id: userId,
    source: 'apple',
    payload,
    headers: {
      'content-type': request.headers.get('content-type'),
      'user-agent': request.headers.get('user-agent'),
    },
  });
  if (received.error) {
    console.error('health import save', received.error.message);
    return Response.json({ error: 'No se pudo guardar el import.' }, { status: 500 });
  }

  const daily = new Map<
    string,
    { steps?: number; active?: number; basal?: number; distance?: number }
  >();
  const addDay = (date: string) => {
    const current = daily.get(date) ?? {};
    daily.set(date, current);
    return current;
  };

  const canonicalDate = dateKey(payload.date) ?? todayKey();
  const canonicalSteps = numberFrom(payload.steps);
  const canonicalActive = kcalFrom(payload.active_kcal ?? payload.activeEnergy, payload.active_kcal_units);
  const canonicalBasal = kcalFrom(payload.basal_kcal ?? payload.basalEnergy, payload.basal_kcal_units);
  const canonicalDistance = kmFrom(payload.distance_km ?? payload.distance, payload.distance_units);
  if ([canonicalSteps, canonicalActive, canonicalBasal, canonicalDistance].some((v) => v !== null)) {
    const day = addDay(canonicalDate);
    if (canonicalSteps !== null) day.steps = (day.steps ?? 0) + canonicalSteps;
    if (canonicalActive !== null) day.active = (day.active ?? 0) + canonicalActive;
    if (canonicalBasal !== null) day.basal = (day.basal ?? 0) + canonicalBasal;
    if (canonicalDistance !== null) day.distance = (day.distance ?? 0) + canonicalDistance;
  }

  for (const metric of metricCollection(payload)) {
    const name = metricName(metric);
    const units = metric.units;
    const isBasal = /basal|restingenergy/.test(name);
    const isActive = !isBasal && /activeenergy|activecalorie|caloriesburned/.test(name);
    const isSteps = /stepcount|^steps?$/.test(name) || name.startsWith('stepcount');
    const isDistance = /distance/.test(name);
    if (!isBasal && !isActive && !isSteps && !isDistance) continue;

    for (const sample of metricSamples(metric)) {
      const date = dateKey(sample.date ?? sample.startDate ?? sample.start ?? sample.timestamp ?? metric.date) ?? canonicalDate;
      const value = numberFrom(sample.qty ?? sample.value ?? sample.quantity ?? sample.doubleValue ?? sample);
      if (value === null) continue;
      const day = addDay(date);
      if (isBasal) day.basal = (day.basal ?? 0) + (kcalFrom(value, units) ?? 0);
      else if (isActive) day.active = (day.active ?? 0) + (kcalFrom(value, units) ?? 0);
      else if (isSteps) day.steps = (day.steps ?? 0) + value;
      else if (isDistance) day.distance = (day.distance ?? 0) + (kmFrom(value, units) ?? 0);
    }
  }

  const dailyRows = [...daily.entries()].map(([log_date, value]) => {
    const row: AnyRecord = {
      user_id: userId,
      log_date,
      source: 'apple',
    };
    if (value.steps !== undefined) row.steps = Math.max(0, Math.round(value.steps));
    if (value.active !== undefined) row.active_kcal = Math.max(0, Math.round(value.active));
    if (value.basal !== undefined) row.basal_kcal = Math.max(0, Math.round(value.basal));
    if (value.distance !== undefined) row.distance_km = Math.round(value.distance * 100) / 100;
    return row;
  });

  if (dailyRows.length) {
    const saved = await admin
      .from('daily_activity')
      .upsert(dailyRows, { onConflict: 'user_id,log_date' });
    if (saved.error) {
      console.error('health daily save', saved.error.message);
      return Response.json({ error: 'No se pudo guardar la actividad.' }, { status: 500 });
    }
  }

  const workouts = workoutCollection(payload);
  const workoutRows: AnyRecord[] = [];
  for (const workout of workouts) {
    const name = workoutName(workout);
    const start = workout.start ?? workout.startDate ?? workout.start_time ?? workout.startTime;
    const end = workout.end ?? workout.endDate ?? workout.end_time ?? workout.endTime;
    const day = dateKey(start) ?? dateKey(end) ?? canonicalDate;
    const externalId = String(
      workout.id ??
        workout.uuid ??
        workout.workoutID ??
        sha256(`${name}|${start ?? ''}|${end ?? ''}`).slice(0, 24),
    );
    const energy = kcalFrom(
      workout.energy ?? workout.activeEnergy ?? workout.totalEnergyBurned ?? workout.calories,
      workout.energy_units ?? workout.units,
    );
    const distance = kmFrom(
      workout.distance_km ?? workout.distance ?? workout.totalDistance,
      workout.distance_units ?? workout.units,
    );
    const duration = durationMinutes(
      workout.duration_min ?? workout.durationMinutes ?? workout.duration,
    );
    const row: AnyRecord = {
      user_id: userId,
      session_date: day,
      kind: workoutKind(name),
      notes: `Apple Health: ${name}`.slice(0, 2000),
      source: 'apple',
      external_id: externalId,
    };
    if (duration !== null) row.duration_min = Math.max(0, Math.min(600, duration));
    if (energy !== null) row.calories_burned = Math.max(0, Math.min(5000, Math.round(energy)));
    if (distance !== null) row.distance_km = Math.max(0, Math.min(500, Math.round(distance * 100) / 100));
    const startedAt = isoDate(start);
    const endedAt = isoDate(end);
    if (startedAt) row.started_at = startedAt;
    if (endedAt) row.ended_at = endedAt;
    const avgHr = numberFrom(workout.avg_hr ?? workout.averageHeartRate ?? workout.heartRate);
    const maxHr = numberFrom(workout.max_hr ?? workout.maxHeartRate);
    if (avgHr !== null && avgHr >= 20 && avgHr <= 250) row.avg_hr = Math.round(avgHr);
    if (maxHr !== null && maxHr >= 20 && maxHr <= 250) row.max_hr = Math.round(maxHr);
    workoutRows.push(row);
  }

  if (workoutRows.length) {
    const saved = await admin.from('training_sessions').upsert(workoutRows, {
      onConflict: 'user_id,source,external_id',
    });
    if (saved.error) {
      console.error('health workout save', saved.error.message);
      return Response.json({ error: 'No se pudo guardar el entreno.' }, { status: 500 });
    }
  }

  return Response.json({
    ok: true,
    days: dailyRows.length,
    workouts: workoutRows.length,
  });
}
