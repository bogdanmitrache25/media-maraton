'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { resetMyProgress, saveWeeklyLog, toggleSession } from '@/app/plan/actions';
import { PreventionTab } from '@/components/PreventionTab';
import { ThemeToggle } from '@/components/ThemeToggle';
import type { ThemeChoice } from '@/lib/theme';
import {
  DAY_NAMES,
  PHASES,
  WEEKS,
  dateOf,
  dayIndexIn,
  formatRange,
  isCountable,
  weekOfDate,
  weekTotal,
  type SessionType,
  type Week,
} from '@/lib/plan-data';

export interface LogRow {
  week: number;
  km: number | null;
  pain: number | null;
  cadence: number | null;
  sleep: number | null;
  palpD: number | null;
  palpI: number | null;
  acwr: number | null;
  notes: string | null;
}

interface Props {
  user: { name: string; email: string; avatarUrl: string | null };
  initialDone: string[];
  initialLogs: LogRow[];
  serverToday: string;
  theme?: ThemeChoice;
}

type Tab = 'hoy' | 'plan' | 'pre' | 'reg';

const KEY = (week: number, day: number) => `${week}:${day}`;

/** Código tipográfico de sesión. Sustituye a los iconos y a los badges de color. */
const CODE: Record<SessionType, string> = {
  A: 'FONDO',
  B: 'CALIDAD',
  C: 'CRUCE',
  G: 'FUERZA',
  R: 'LIBRE',
  T: 'TEST',
  Z: 'CARRERA',
};

/** Intensidad 0-3. Es lo que codifica el color de la regla izquierda. */
const INTENSITY: Record<SessionType, 0 | 1 | 2 | 3> = {
  R: 0,
  C: 1,
  G: 1,
  A: 2,
  B: 2,
  T: 3,
  Z: 3,
};

function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`;
}

const rangeShort = (iso: string) =>
  new Date(`${iso}T12:00:00Z`)
    .toLocaleDateString('es-ES', { day: '2-digit', month: 'short', timeZone: 'UTC' })
    .replace(/\./g, '')
    .toUpperCase();

export function PlanApp({ user, initialDone, initialLogs, serverToday, theme }: Props) {
  const [tab, setTab] = useState<Tab>('hoy');
  const [today, setToday] = useState(serverToday);
  const [done, setDone] = useState<Set<string>>(() => new Set(initialDone));
  const [logs, setLogs] = useState<Record<number, LogRow>>(() => {
    const map: Record<number, LogRow> = {};
    for (const log of initialLogs) map[log.week] = log;
    return map;
  });
  const [openWeeks, setOpenWeeks] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => setToday(localToday()), []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2800);
  }, []);

  /* ---------------------------------------------------------------- */

  const progressOf = useCallback(
    (w: Week) => {
      let total = 0;
      let complete = 0;
      for (let i = 0; i < 7; i++) {
        const day = w.days[i];
        if (!day || !isCountable(day.type)) continue;
        total++;
        if (done.has(KEY(w.n, i))) complete++;
      }
      return { total, complete };
    },
    [done],
  );

  const overall = useMemo(() => {
    let total = 0;
    let complete = 0;
    for (const w of WEEKS) {
      const p = progressOf(w);
      total += p.total;
      complete += p.complete;
    }
    return { total, complete, pct: total ? Math.round((complete / total) * 100) : 0 };
  }, [progressOf]);

  const handleToggle = useCallback(
    async (week: number, day: number) => {
      const key = KEY(week, day);
      const wasDone = done.has(key);

      setDone((prev) => {
        const next = new Set(prev);
        if (wasDone) next.delete(key);
        else next.add(key);
        return next;
      });

      const rollback = () =>
        setDone((prev) => {
          const next = new Set(prev);
          if (wasDone) next.add(key);
          else next.delete(key);
          return next;
        });

      try {
        const result = await toggleSession({ week, day, done: !wasDone });
        if (!result.ok) {
          rollback();
          showToast(result.error);
        }
      } catch {
        rollback();
        showToast('Sin conexión. Inténtalo de nuevo.');
      }
    },
    [done, showToast],
  );

  /* ---------------------------------------------------------------- */

  return (
    <div className="shell">
      <header className="hdr">
        <div className="hdr-top">
          <div style={{ minWidth: 0 }}>
            <p className="wordmark">
              MM <em>1:50</em>
            </p>
            <p className="hdr-sub">14 MAR 2027 · {user.name}</p>
          </div>
          <ThemeToggle initial={theme} />
        </div>

        <div className="strip">
          <div className="strip-bars">
            {WEEKS.map((w, idx) => {
              const { total, complete } = progressOf(w);
              const pct = total ? (complete / total) * 100 : 0;
              const isNow = weekOfDate(today)?.n === w.n;
              const prev = WEEKS[idx - 1];
              const newPhase = prev ? prev.phase !== w.phase : false;
              return (
                <div
                  key={w.n}
                  className={[
                    'bar',
                    pct >= 100 ? 'is-full' : '',
                    isNow ? 'is-now' : '',
                    pct === 0 ? 'is-empty' : '',
                    newPhase ? 'gap' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  title={`Semana ${w.n} · ${complete}/${total}`}
                >
                  <div className="bar-track">
                    <div className="bar-fill" style={{ height: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="strip-legend">
            <span>S01</span>
            <span className="strip-count">
              {overall.complete}/{overall.total} · {overall.pct}%
            </span>
            <span>S23</span>
          </div>
        </div>
      </header>

      <main className="main">
        <section className={`view ${tab === 'hoy' ? 'on' : ''}`}>
          <TodayView
            today={today}
            done={done}
            onToggle={handleToggle}
            progressOf={progressOf}
          />
        </section>

        <section className={`view ${tab === 'plan' ? 'on' : ''}`}>
          <PlanView
            today={today}
            done={done}
            openWeeks={openWeeks}
            setOpenWeeks={setOpenWeeks}
            progressOf={progressOf}
            onToggle={handleToggle}
          />
        </section>

        <section className={`view ${tab === 'pre' ? 'on' : ''}`}>
          <PreventionTab />
        </section>

        <section className={`view ${tab === 'reg' ? 'on' : ''}`}>
          <LogView today={today} logs={logs} setLogs={setLogs} showToast={showToast} />
        </section>

        <div className="sect">
          <p className="eyebrow">Cuenta</p>
          <p className="num soft" style={{ fontSize: 12, margin: '10px 0 16px' }}>
            {user.email}
          </p>
          <form action="/auth/signout" method="post">
            <button className="btn" type="submit">
              Cerrar sesión
            </button>
          </form>
        </div>
      </main>

      <nav className="rail">
        <TabButton id="hoy" label="Hoy" tab={tab} setTab={setTab} />
        <TabButton id="plan" label="Plan" tab={tab} setTab={setTab} />
        <TabButton id="pre" label="Protección" tab={tab} setTab={setTab} />
        <TabButton id="reg" label="Registro" tab={tab} setTab={setTab} />
      </nav>

      <div className={`toast ${toast ? 'on' : ''}`} role="status" aria-live="polite">
        {toast}
      </div>
    </div>
  );
}

/* ==================================================================== */

function TabButton({
  id,
  label,
  tab,
  setTab,
}: {
  id: Tab;
  label: string;
  tab: Tab;
  setTab: (t: Tab) => void;
}) {
  const on = tab === id;
  return (
    <button
      type="button"
      aria-current={on ? 'page' : undefined}
      onClick={() => {
        setTab(id);
        document.querySelector('main.main')?.scrollTo({ top: 0 });
      }}
    >
      {label}
    </button>
  );
}

/* ==================================================================== */
/*  HOY                                                                 */
/* ==================================================================== */

function TodayView({
  today,
  done,
  onToggle,
  progressOf,
}: {
  today: string;
  done: Set<string>;
  onToggle: (w: number, d: number) => void;
  progressOf: (w: Week) => { total: number; complete: number };
}) {
  const week = weekOfDate(today);
  const dayIndex = week ? dayIndexIn(week, today) : -1;

  const milestone = useMemo(() => {
    const list = [
      { date: '2026-11-18', label: 'Test de 5K' },
      { date: '2027-01-06', label: 'Test de 10K' },
      { date: '2027-02-07', label: 'Tune-up 10K' },
      { date: '2027-03-14', label: 'Media maratón' },
    ];
    return list.find((m) => m.date >= today) ?? null;
  }, [today]);

  if (!week || dayIndex < 0) {
    return (
      <div className="hero" style={{ marginTop: 18 }}>
        <p className="eyebrow">Fuera de plan</p>
        <h2 className="hero-title">Sin sesión hoy</h2>
        <p className="hero-note">
          El plan cubre del 5 de octubre de 2026 al 14 de marzo de 2027.
        </p>
      </div>
    );
  }

  const phase = PHASES[week.phase];
  const session = week.days[dayIndex];
  const { total, complete } = progressOf(week);
  const isDone = session ? done.has(KEY(week.n, dayIndex)) : false;

  const daysToMilestone = milestone
    ? Math.max(
        0,
        Math.round(
          (Date.parse(`${milestone.date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000,
        ),
      )
    : 0;

  return (
    <>
      <div className="hero">
        <p className="eyebrow">
          FASE {week.phase} · SEMANA {String(week.n).padStart(2, '0')} · {phase.name.toUpperCase()}
        </p>

        {session ? (
          <>
            <h2 className="hero-title">{session.title}</h2>
            <div className="hero-meta">
              <span>
                {DAY_NAMES[dayIndex]?.toUpperCase()} {rangeShort(today)}
              </span>
              <span>{CODE[session.type]}</span>
              {week.km !== 'carrera' && <span>{week.km.toUpperCase()}</span>}
            </div>

            {isCountable(session.type) ? (
              <button
                type="button"
                className="hero-action"
                aria-pressed={isDone}
                onClick={() => onToggle(week.n, dayIndex)}
              >
                {isDone ? 'Hecha — desmarcar' : 'Marcar como hecha'}
              </button>
            ) : (
              <p className="hero-note">
                Día de descanso. Rutina tibial y de sóleo, 8-10 min.
              </p>
            )}

            {session.desc && <p className="hero-note">{session.desc}</p>}
          </>
        ) : null}
      </div>

      <div className="sect">
        <div className="sect-head">
          <p className="eyebrow">Semana en curso</p>
          <span className="num soft" style={{ fontSize: 11 }}>
            {complete}/{total}
          </span>
        </div>
        <div className="ledger">
          {week.days.map((day, i) => (
            <DayRow
              key={i}
              day={day}
              dayIndex={i}
              done={done.has(KEY(week.n, i))}
              isToday={i === dayIndex}
              onToggle={() => onToggle(week.n, i)}
            />
          ))}
        </div>
      </div>

      {milestone && (
        <div className="sect">
          <p className="eyebrow">Próximo hito</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 12 }}>
            <p className="hero-num">{daysToMilestone}</p>
            <p className="num dim" style={{ fontSize: 11, letterSpacing: '0.1em' }}>
              DÍAS · {milestone.label.toUpperCase()}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

/* ==================================================================== */
/*  PLAN                                                                */
/* ==================================================================== */

function PlanView({
  today,
  done,
  openWeeks,
  setOpenWeeks,
  progressOf,
  onToggle,
}: {
  today: string;
  done: Set<string>;
  openWeeks: Set<number>;
  setOpenWeeks: (fn: (prev: Set<number>) => Set<number>) => void;
  progressOf: (w: Week) => { total: number; complete: number };
  onToggle: (w: number, d: number) => void;
}) {
  const order = [1, 2, 3, 4, 5, 6] as const;

  return (
    <>
      {order.map((p) => {
        const phase = PHASES[p];
        const weeks = WEEKS.filter((w) => w.phase === p);
        if (!weeks.length) return null;

        return (
          <div key={p}>
            <div className="phase">
              <span className="phase-name">{phase.name}</span>
              <span className="phase-rule" />
              <span className="eyebrow">{phase.weeks}</span>
            </div>

            {weeks.map((w) => {
              const { total, complete } = progressOf(w);
              const open = openWeeks.has(w.n);
              const full = total > 0 && complete === total;
              return (
                <div key={w.n} className={`week ${open ? 'open' : ''}`} data-full={full ? 1 : 0}>
                  <button
                    type="button"
                    className="week-h"
                    aria-expanded={open}
                    onClick={() =>
                      setOpenWeeks((prev) => {
                        const next = new Set(prev);
                        if (next.has(w.n)) next.delete(w.n);
                        else next.add(w.n);
                        return next;
                      })
                    }
                  >
                    <span className="week-n">S{String(w.n).padStart(2, '0')}</span>
                    <span>
                      <span className="week-f">{w.focus}</span>
                      <span className="week-s">
                        {formatRange(w.start)} · {complete}/{total}
                        {w.test ? ' · TEST' : ''}
                        {w.race ? ' · CARRERA' : ''}
                      </span>
                    </span>
                    <span className="week-km">{w.km}</span>
                  </button>

                  <div className="week-b">
                    {w.note && <p className="week-note">{w.note}</p>}
                    <div className="ledger">
                      {w.days.map((day, i) => (
                        <DayRow
                          key={i}
                          day={day}
                          dayIndex={i}
                          done={done.has(KEY(w.n, i))}
                          isToday={dateOf(w.n, i) === today}
                          onToggle={() => onToggle(w.n, i)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

/* ==================================================================== */
/*  FILA DE DÍA                                                         */
/* ==================================================================== */

function DayRow({
  day,
  dayIndex,
  done,
  isToday,
  onToggle,
}: {
  day: { type: SessionType; title: string; desc: string };
  dayIndex: number;
  done: boolean;
  isToday: boolean;
  onToggle: () => void;
}) {
  const locked = !isCountable(day.type);

  const inner = (
    <>
      <span className="row-day">{DAY_NAMES[dayIndex]}</span>
      <span className="row-body">
        <span className="row-code">{CODE[day.type]}</span>
        <span className="row-title">{day.title}</span>
        {day.desc && <span className="row-desc">{day.desc}</span>}
      </span>
      <span className="row-mark">{done && <Tick />}</span>
    </>
  );

  if (locked) {
    return (
      <div
        className="row"
        data-i={INTENSITY[day.type]}
        data-locked="1"
        data-today={isToday ? '1' : '0'}
      >
        {inner}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="row"
      data-i={INTENSITY[day.type]}
      data-done={done ? '1' : '0'}
      data-today={isToday ? '1' : '0'}
      aria-pressed={done}
      aria-label={`${DAY_NAMES[dayIndex]}: ${day.title}`}
      onClick={onToggle}
    >
      {inner}
    </button>
  );
}

function Tick() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
      <path
        d="M2 6.5 4.6 9 10 3.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="square"
      />
    </svg>
  );
}

/* ==================================================================== */
/*  REGISTRO                                                            */
/* ==================================================================== */

function LogView({
  today,
  logs,
  setLogs,
  showToast,
}: {
  today: string;
  logs: Record<number, LogRow>;
  setLogs: (fn: (prev: Record<number, LogRow>) => Record<number, LogRow>) => void;
  showToast: (m: string) => void;
}) {
  const [week, setWeek] = useState(() => weekOfDate(today)?.n ?? 1);
  const [saving, setSaving] = useState(false);
  const current = logs[week];

  const [calc, setCalc] = useState({ w1: '', w2: '', w3: '', w4: '', cur: '' });
  const [result, setResult] = useState<{ v: number; label: string; color: string } | null>(null);

  function computeAcwr() {
    const nums = [calc.w1, calc.w2, calc.w3, calc.w4]
      .map((v) => Number(String(v).replace(',', '.')))
      .filter((n) => Number.isFinite(n));
    const cur = Number(String(calc.cur).replace(',', '.'));
    if (!nums.length || calc.cur === '' || !Number.isFinite(cur)) return setResult(null);

    const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
    if (avg <= 0) return setResult(null);

    const v = cur / avg;
    let label: string;
    let color: string;
    if (v < 0.8) {
      label = 'Infraentrenamiento. Puedes subir.';
      color = 'var(--ink-mid)';
    } else if (v <= 1.3) {
      label = 'Zona segura. Adelante.';
      color = 'var(--done)';
    } else if (v <= 1.5) {
      label = 'Riesgo elevado. No subas esta semana.';
      color = 'var(--warn)';
    } else {
      label = 'Zona de lesión. Repite o baja.';
      color = 'var(--alert)';
    }
    setResult({ v, label, color });
  }

  async function submit(formData: FormData) {
    setSaving(true);
    try {
      const res = await saveWeeklyLog(formData);
      if (!res.ok) return showToast(res.error);

      const n = Number(formData.get('week'));
      const num = (k: string) => {
        const raw = String(formData.get(k) ?? '').replace(',', '.');
        if (raw === '') return null;
        const x = Number(raw);
        return Number.isFinite(x) ? x : null;
      };
      setLogs((prev) => ({
        ...prev,
        [n]: {
          week: n,
          km: num('km'),
          pain: num('pain'),
          cadence: num('cadence'),
          sleep: num('sleep'),
          palpD: num('palpD'),
          palpI: num('palpI'),
          acwr: result ? Number(result.v.toFixed(2)) : (prev[n]?.acwr ?? null),
          notes: String(formData.get('notes') ?? '').trim() || null,
        },
      }));
      showToast('Semana guardada');
    } catch {
      showToast('Sin conexión. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (!window.confirm('¿Borrar todo tu progreso y tus registros? No se puede deshacer.')) return;
    setSaving(true);
    try {
      const res = await resetMyProgress();
      if (!res.ok) return showToast(res.error);
      window.location.reload();
    } catch {
      showToast('Sin conexión. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  const history = Object.values(logs).sort((a, b) => a.week - b.week);

  return (
    <>
      <div className="sect">
        <p className="eyebrow">Calculadora de carga</p>
        <p className="dim" style={{ fontSize: 13, margin: '10px 0 16px', maxWidth: '38ch' }}>
          Kilómetros de las cuatro semanas anteriores y de la actual. El cociente dice si puedes
          subir.
        </p>

        <div className="grid2">
          <Field label="Semana −4">
            <input
              className="input"
              type="number"
              inputMode="decimal"
              value={calc.w1}
              onChange={(e) => setCalc((s) => ({ ...s, w1: e.target.value }))}
            />
          </Field>
          <Field label="Semana −3">
            <input
              className="input"
              type="number"
              inputMode="decimal"
              value={calc.w2}
              onChange={(e) => setCalc((s) => ({ ...s, w2: e.target.value }))}
            />
          </Field>
          <Field label="Semana −2">
            <input
              className="input"
              type="number"
              inputMode="decimal"
              value={calc.w3}
              onChange={(e) => setCalc((s) => ({ ...s, w3: e.target.value }))}
            />
          </Field>
          <Field label="Semana −1">
            <input
              className="input"
              type="number"
              inputMode="decimal"
              value={calc.w4}
              onChange={(e) => setCalc((s) => ({ ...s, w4: e.target.value }))}
            />
          </Field>
        </div>

        <Field label="Semana actual">
          <input
            className="input"
            type="number"
            inputMode="decimal"
            value={calc.cur}
            onChange={(e) => setCalc((s) => ({ ...s, cur: e.target.value }))}
          />
        </Field>

        <button className="btn btn-solid" type="button" onClick={computeAcwr}>
          Calcular
        </button>

        <p className="out" style={result ? { color: result.color } : undefined}>
          {result ? result.v.toFixed(2) : '—'}
        </p>
        {result && (
          <p
            className="eyebrow"
            style={{ textAlign: 'center', color: result.color, letterSpacing: '0.1em' }}
          >
            {result.label}
          </p>
        )}
      </div>

      <div className="sect">
        <p className="eyebrow">Cierre de semana</p>
        <form action={submit} key={week} style={{ marginTop: 16 }}>
          <Field label="Semana">
            <select
              className="input"
              name="week"
              value={week}
              onChange={(e) => setWeek(Number(e.target.value))}
            >
              {WEEKS.map((w) => (
                <option key={w.n} value={w.n}>
                  S{String(w.n).padStart(2, '0')} · {formatRange(w.start)}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid2">
            <Field label="Km totales">
              <input className="input" name="km" type="number" inputMode="decimal" defaultValue={current?.km ?? ''} />
            </Field>
            <Field label="Dolor máx 0-10">
              <input className="input" name="pain" type="number" inputMode="numeric" defaultValue={current?.pain ?? ''} />
            </Field>
            <Field label="Cadencia ppm">
              <input className="input" name="cadence" type="number" inputMode="numeric" defaultValue={current?.cadence ?? ''} />
            </Field>
            <Field label="Sueño medio h">
              <input className="input" name="sleep" type="number" inputMode="decimal" step="0.1" defaultValue={current?.sleep ?? ''} />
            </Field>
            <Field label="Tibia D cm">
              <input className="input" name="palpD" type="number" inputMode="decimal" step="0.5" defaultValue={current?.palpD ?? ''} />
            </Field>
            <Field label="Tibia I cm">
              <input className="input" name="palpI" type="number" inputMode="decimal" step="0.5" defaultValue={current?.palpI ?? ''} />
            </Field>
          </div>

          <input type="hidden" name="acwr" value={result ? result.v.toFixed(2) : ''} />

          <Field label="Notas">
            <input className="input" name="notes" type="text" maxLength={500} defaultValue={current?.notes ?? ''} />
          </Field>

          <button className="btn" type="submit" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar semana'}
          </button>
        </form>
      </div>

      <div className="sect">
        <p className="eyebrow">Historial</p>
        {history.length === 0 ? (
          <p className="dim" style={{ fontSize: 13, marginTop: 12 }}>
            Sin registros todavía.
          </p>
        ) : (
          <table className="kv" style={{ marginTop: 14 }}>
            <thead>
              <tr>
                <th>Sem</th>
                <th>Km</th>
                <th>Dolor</th>
                <th>Cad</th>
                <th>Tibia</th>
                <th>ACWR</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r) => (
                <tr key={r.week}>
                  <td>
                    <b>S{String(r.week).padStart(2, '0')}</b>
                  </td>
                  <td>{r.km ?? '—'}</td>
                  <td>{r.pain ?? '—'}</td>
                  <td>{r.cadence ?? '—'}</td>
                  <td>
                    {r.palpD ?? '—'}/{r.palpI ?? '—'}
                  </td>
                  <td>{r.acwr ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="sect">
        <p className="eyebrow">Datos</p>
        <p className="dim" style={{ fontSize: 13, margin: '10px 0 16px', maxWidth: '38ch' }}>
          Tu progreso vive en tu cuenta. Entra desde cualquier dispositivo y estará ahí.
        </p>
        <button className="btn btn-danger" type="button" onClick={reset} disabled={saving}>
          Borrar todo mi progreso
        </button>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}
