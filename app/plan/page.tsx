import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClientWithUser } from '@/lib/supabase/server';
import { PlanApp, type LogRow } from '@/components/PlanApp';
import { normalizeTheme, THEME_COOKIE, type ThemeChoice } from '@/lib/theme';

export const dynamic = 'force-dynamic';

export default async function PlanPage() {
  const cookieStore = await cookies();
  const stored = cookieStore.get(THEME_COOKIE)?.value;
  const theme: ThemeChoice = normalizeTheme(stored) ?? 'system';

  const { supabase, user } = await createClientWithUser();
  if (!user) redirect('/login');

  // Lectura en paralelo. RLS garantiza que solo llegan filas de este usuario.
  const [profileRes, sessionsRes, logsRes] = await Promise.all([
    supabase.from('profiles').select('display_name, avatar_url').eq('id', user.id).maybeSingle(),
    supabase.from('session_completions').select('week, day').eq('user_id', user.id),
    supabase
      .from('weekly_logs')
      .select('week, km, pain, cadence, sleep, palp_d, palp_i, acwr, notes')
      .eq('user_id', user.id),
  ]);

  const done = (sessionsRes.data ?? []).map((row) => `${row.week}:${row.day}`);

  const logs: LogRow[] = (logsRes.data ?? []).map((row) => ({
    week: row.week,
    km: row.km,
    pain: row.pain,
    cadence: row.cadence,
    sleep: row.sleep,
    palpD: row.palp_d,
    palpI: row.palp_i,
    acwr: row.acwr,
    notes: row.notes,
  }));

  const email = user.email ?? '';
  const name = profileRes.data?.display_name || email.split('@')[0] || 'Atleta';

  return (
    <PlanApp
      user={{
        name,
        email,
        avatarUrl: profileRes.data?.avatar_url ?? null,
      }}
      initialDone={done}
      initialLogs={logs}
      serverToday={new Date().toISOString().slice(0, 10)}
      theme={theme}
    />
  );
}
