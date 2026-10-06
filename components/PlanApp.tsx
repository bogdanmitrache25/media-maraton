'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { resetMyProgress, saveWeeklyLog, toggleSession } from '@/app/plan/actions';
import { PreventionTab } from '@/components/PreventionTab';
import {
  DAY_NAMES,
  PHASES,
  SESSION_TYPES,
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
}

type Tab = 'hoy' | 'plan' | 'pre' | 'reg';

const KEY = (week: number, day: number) => `${week}:${day}`;

/** Fecha local del dispositivo en formato YYYY-MM-DD. */
function localToday(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function PlanApp({ user, initialDone, initialLogs, serverToday }: Props) {
  const [tab, setTab] = useState<Tab>('hoy');
  // Arrancamos con la fecha del servidor (coincide con el HTML prerenderizado)
  // y la corregimos a la fecha local del dispositivo tras hidratar.
  const [today, setToday] = useState(serverToday);
  const [done, setDone] = useState<Set<string>>(() => new Set(initialDone));
  const [logs, setLogs] = useState<Record<number, LogRow>>(() => {
    const map: Record<number, LogRow> = {};
    for (const log of initialLogs) map[log.week] = log;
    return map;
  });
  const [openWeeks, setOpenWeeks] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setToday(localToday());
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Progreso                                                         */
  /* ---------------------------------------------------------------- */

  const { totalSessions, doneSessions } = useMemo(() => {
    let total = 0;
    let complete = 0;
    for (const w of WEEKS) {
      total += weekTotal(w);
      for (let i = 0; i < 7; i++) {
        const day = w.days[i];
        if (day && isCountable(day.type) && done.has(KEY(w.n, i))) complete++;
      }
    }
    return { totalSessions: total, doneSessions: complete };
  }, [done]);

  const percent = totalSessions ? Math.round((doneSessions / totalSessions) * 100) : 0;

  const weekProgress = useCallback(
    (w: Week) => {
      const total = weekTotal(w);
      let complete = 0;
      for (let i = 0; i < 7; i++) {
        const day = w.days[i];
        if (day && isCountable(day.type) && done.has(KEY(w.n, i))) complete++;
      }
      return { total, complete };
    },
    [done],
  );

  /* ---------------------------------------------------------------- */
  /*  Marcar / desmarcar                                               */
  /* ---------------------------------------------------------------- */

  const handleToggle = useCallback(
    async (week: number, day: number) => {
      const key = KEY(week, day);
      const wasDone = done.has(key);

      // Actualización optimista: la interfaz responde al instante.
      setDone((prev) => {
        const next = new Set(prev);
        if (wasDone) next.delete(key);
        else next.add(key);
        return next;
      });

      try {
        const result = await toggleSession({ week, day, done: !wasDone });
        if (!result.ok) {
          // Revertimos si el servidor lo rechazó.
          setDone((prev) => {
            const next = new Set(prev);
            if (wasDone) next.add(key);
            else next.delete(key);
            return next;
          });
          showToast(result.error);
        }
      } catch {
        setDone((prev) => {
          const next = new Set(prev);
          if (wasDone) next.add(key);
          else next.delete(key);
          return next;
        });
        showToast('Sin conexión. Inténtalo de nuevo.');
      }
    },
    [done, showToast],
  );

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <>
      <header className="app-header">
        <div className="hd-row">
          <div style={{ minWidth: 0 }}>
            <div className="hd-title">Media Maratón</div>
            <div className="hd-sub">14 de marzo de 2027 · {user.name}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 'none' }}>
            <span className="hd-goal">1:50</span>
            {user.avatarUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt=""
                width={30}
                height={30}
                style={{ borderRadius: '50%', border: '1px solid var(--line)' }}
                referrerPolicy="no-referrer"
              />
            )}
          </div>
        </div>
        <div className="bar">
          <i style={{ width: `${percent}%` }} />
        </div>
        <div className="bar-lbl">
          <span>{percent} % completado</span>
          <span>
            {doneSessions}/{totalSessions} sesiones
          </span>
        </div>
      </header>

      <main className="app-main">
        <section className={`view ${tab === 'hoy' ? 'on' : ''}`}>
          <TodayView
            today={today}
            done={done}
            onToggle={handleToggle}
          />
        </section>

        <section className={`view ${tab === 'plan' ? 'on' : ''}`}>
          <PlanView
            today={today}
            done={done}
            openWeeks={openWeeks}
            setOpenWeeks={setOpenWeeks}
            weekProgress={weekProgress}
            onToggle={handleToggle}
          />
        </section>

        <section className={`view ${tab === 'pre' ? 'on' : ''}`}>
          <PreventionTab />
        </section>

        <section className={`view ${tab === 'reg' ? 'on' : ''}`}>
          <LogView
            today={today}
            logs={logs}
            setLogs={setLogs}
            showToast={showToast}
          />
        </section>

        <div className="card" style={{ marginTop: 20 }}>
          <h3>Sesión</h3>
          <div className="tiny" style={{ marginBottom: 10 }}>
            {user.email}
          </div>
          <form action="/auth/signout" method="post">
            <button className="btn" type="submit">
              Cerrar sesión
            </button>
          </form>
        </div>
      </main>

      <nav className="tabbar">
        <TabButton id="hoy" label="Hoy" icon="◎" tab={tab} setTab={setTab} />
        <TabButton id="plan" label="Plan" icon="▤" tab={tab} setTab={setTab} />
        <TabButton id="pre" label="Prevención" icon="✚" tab={tab} setTab={setTab} />
        <TabButton id="reg" label="Registro" icon="✎" tab={tab} setTab={setTab} />
      </nav>

      <div className={`toast ${toast ? 'on' : ''}`} role="status" aria-live="polite">
        {toast}
      </div>
    </>
  );
}

/* ==================================================================== */
/*  Pestañas                                                            */
/* ==================================================================== */

function TabButton({
  id,
  label,
  icon,
  tab,
  setTab,
}: {
  id: Tab;
  label: string;
  icon: string;
  tab: Tab;
  setTab: (t: Tab) => void;
}) {
  return (
    <button
      className={tab === id ? 'on' : ''}
      onClick={() => {
        setTab(id);
        document.querySelector('main.app-main')?.scrollTo({ top: 0 });
      }}
      type="button"
      aria-current={tab === id ? 'page' : undefined}
    >
      <b aria-hidden="true">{icon}</b>
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
}: {
  today: string;
  done: Set<string>;
  onToggle: (w: number, d: number) => void;
}) {
  const currentWeek = weekOfDate(today);
  const dayIndex = currentWeek ? dayIndexIn(currentWeek, today) : -1;

  const nextMilestone = useMemo(() => {
    const milestones = [
      { date: '2026-11-18', label: '🔬 Test de 5K en cinta' },
      { date: '2027-01-06', label: '🔬 Test de 10K — checkpoint del objetivo' },
      { date: '2027-02-07', label: '🏁 Tune-up: 10K a ritmo de competición' },
      { date: '2027-03-14', label: '🏁 MEDIA MARATÓN — objetivo 1:50:00' },
    ];
    return milestones.find((m) => m.date >= today) ?? null;
  }, [today]);

  if (!currentWeek || dayIndex < 0) {
    return (
      <div className="card">
        <h3>Fuera de la ventana del plan</h3>
        <div className="muted">Hoy no cae dentro de las 23 semanas de preparación.</div>
        <div className="muted" style={{ marginTop: 8 }}>
          El plan arranca el 5 de octubre de 2026 y termina el 14 de marzo de 2027.
        </div>
      </div>
    );
  }

  const phase = PHASES[currentWeek.phase];
  const todaySession = currentWeek.days[dayIndex];
  const daysToMilestone = nextMilestone
    ? Math.max(
        0,
        Math.round(
          (Date.parse(`${nextMilestone.date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) /
            86400000,
        ),
      )
    : 0;

  return (
    <>
      <div className="card" style={{ borderColor: `${phase.color}55` }}>
        <div className="tiny" style={{ color: phase.color, fontWeight: 800, letterSpacing: 0.5 }}>
          FASE {currentWeek.phase} · {phase.name.toUpperCase()}
        </div>
        <h3 style={{ fontSize: 19, margin: '6px 0 2px' }}>
          Semana {currentWeek.n} · {formatRange(currentWeek.start)}
        </h3>
        <div className="muted">
          {currentWeek.focus} · {currentWeek.km}
        </div>
      </div>

      {todaySession && (
        <div className="card">
          <div className="tiny">HOY · {DAY_NAMES[dayIndex]?.toUpperCase()}</div>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0 4px', flexWrap: 'wrap' }}
          >
            <span className={`d-cap ${typeClass(todaySession.type)}`}>
              {SESSION_TYPES[todaySession.type].label}
            </span>
            <span style={{ fontSize: 15, fontWeight: 650 }}>{todaySession.title}</span>
          </div>
          {todaySession.desc && <div className="muted">{todaySession.desc}</div>}

          {isCountable(todaySession.type) ? (
            <button
              type="button"
              className={`d ${done.has(KEY(currentWeek.n, dayIndex)) ? 'ck' : ''}`}
              style={{ border: 0, padding: '12px 0 0' }}
              onClick={() => onToggle(currentWeek.n, dayIndex)}
              aria-pressed={done.has(KEY(currentWeek.n, dayIndex))}
            >
              <span className="d-main">
                <span className="d-ttl" style={{ fontSize: 13, color: 'var(--tx2)' }}>
                  {done.has(KEY(currentWeek.n, dayIndex)) ? 'Hecha' : 'Marcar como hecha'}
                </span>
              </span>
              <span className="box">✓</span>
            </button>
          ) : (
            <div className="tiny" style={{ marginTop: 10 }}>
              Día de descanso. TB: rutina tibial/sóleo 8-10 min.
            </div>
          )}
        </div>
      )}

      <div className="card">
        <h3>Resto de la semana</h3>
        {currentWeek.days.map((day, i) => (
          <DayRow
            key={i}
            day={day}
            dayIndex={i}
            done={done.has(KEY(currentWeek.n, i))}
            isToday={i === dayIndex}
            onToggle={() => onToggle(currentWeek.n, i)}
          />
        ))}
      </div>

      {nextMilestone && (
        <div className="card">
          <h3>Próximo hito</h3>
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}
          >
            <span style={{ fontSize: 15, fontWeight: 650 }}>{nextMilestone.label}</span>
            <span className="tiny">{daysToMilestone} días</span>
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
  weekProgress,
  onToggle,
}: {
  today: string;
  done: Set<string>;
  openWeeks: Set<number>;
  setOpenWeeks: (fn: (prev: Set<number>) => Set<number>) => void;
  weekProgress: (w: Week) => { total: number; complete: number };
  onToggle: (w: number, d: number) => void;
}) {
  const phaseNumbers = [1, 2, 3, 4, 5, 6] as const;

  return (
    <>
      {phaseNumbers.map((phaseNumber) => {
        const phase = PHASES[phaseNumber];
        const weeks = WEEKS.filter((w) => w.phase === phaseNumber);
        if (weeks.length === 0) return null;

        return (
          <div key={phaseNumber}>
            <div className="phase-h">
              <i style={{ background: phase.color }} />
              {phase.name}
              <span>{phase.weeks}</span>
            </div>

            {weeks.map((w) => {
              const { total, complete } = weekProgress(w);
              const isOpen = openWeeks.has(w.n);
              return (
                <div key={w.n} className={`wk ${complete === total && total > 0 ? 'done' : ''} ${isOpen ? 'open' : ''}`}>
                  <button
                    className="wk-h"
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() =>
                      setOpenWeeks((prev) => {
                        const next = new Set(prev);
                        if (next.has(w.n)) next.delete(w.n);
                        else next.add(w.n);
                        return next;
                      })
                    }
                  >
                    <span className="wk-num" style={{ color: phase.color }}>
                      S{w.n}
                    </span>
                    <span className="wk-mid">
                      <span className="wk-t" style={{ display: 'block' }}>
                        {w.focus}
                      </span>
                      <span className="wk-s" style={{ display: 'block' }}>
                        {formatRange(w.start)} · {complete}/{total} sesiones
                        {w.test ? ' · 🔬 TEST' : ''}
                        {w.race ? ' · 🏁' : ''}
                      </span>
                    </span>
                    <span className="wk-km">{w.km}</span>
                    <span className="chk" aria-hidden="true" />
                  </button>

                  <div className="wk-b">
                    {w.note && (
                      <div className={`note ${w.warn ? 'warn' : ''}`}>
                        {w.warn ? '⚠️ ' : '🎯 '}
                        {w.note}
                      </div>
                    )}
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
              );
            })}
          </div>
        );
      })}
    </>
  );
}

/* ==================================================================== */
/*  Fila de día                                                         */
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
  const meta = SESSION_TYPES[day.type];
  const locked = !isCountable(day.type);

  const inner = (
    <>
      <span className="d-bar" style={{ background: meta.bar }} />
      <span className="d-day">{DAY_NAMES[dayIndex]}</span>
      <span className="d-main">
        <span className="d-top">
          <span className={`d-cap ${typeClass(day.type)}`}>{meta.label}</span>
          <span className="d-ttl">{day.title}</span>
        </span>
        {day.desc && (
          <span className="d-desc" style={{ display: 'block' }}>
            {day.desc}
          </span>
        )}
      </span>
      <span className="box" aria-hidden="true">
        ✓
      </span>
    </>
  );

  if (locked) {
    return (
      <div className={`d d-lock ${isToday ? 'today' : ''}`} aria-hidden="true">
        {inner}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`d ${done ? 'ck' : ''} ${isToday ? 'today' : ''}`}
      onClick={onToggle}
      aria-pressed={done}
      aria-label={`${DAY_NAMES[dayIndex]}: ${day.title}`}
    >
      {inner}
    </button>
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
  const [selectedWeek, setSelectedWeek] = useState(() => weekOfDate(today)?.n ?? 1);
  const [saving, setSaving] = useState(false);

  const current = logs[selectedWeek];

  /* --- Calculadora de ACWR (solo cliente) --- */
  const [acwrInput, setAcwrInput] = useState({ w1: '', w2: '', w3: '', w4: '', current: '' });
  const [acwrResult, setAcwrResult] = useState<{ value: number; label: string; color: string } | null>(
    null,
  );

  function calculateAcwr() {
    const prev = [acwrInput.w1, acwrInput.w2, acwrInput.w3, acwrInput.w4]
      .map((v) => Number(String(v).replace(',', '.')))
      .filter((n) => Number.isFinite(n) && String(n) !== '');
    const cur = Number(String(acwrInput.current).replace(',', '.'));

    if (prev.length === 0 || !Number.isFinite(cur) || acwrInput.current === '') {
      setAcwrResult(null);
      return;
    }
    const avg = prev.reduce((a, b) => a + b, 0) / prev.length;
    if (avg <= 0) {
      setAcwrResult(null);
      return;
    }
    const value = cur / avg;

    let label: string;
    let color: string;
    if (value < 0.8) {
      label = 'Infraentrenamiento. Puedes subir.';
      color = '#60a5fa';
    } else if (value <= 1.3) {
      label = 'Zona segura. Adelante.';
      color = '#22c55e';
    } else if (value <= 1.5) {
      label = 'Riesgo elevado. NO subas esta semana.';
      color = '#eab308';
    } else {
      label = 'Zona de lesión. Repite o baja el volumen.';
      color = '#ef4444';
    }
    setAcwrResult({ value, label, color });
  }

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    try {
      const result = await saveWeeklyLog(formData);
      if (!result.ok) {
        showToast(result.error);
        return;
      }
      const week = Number(formData.get('week'));
      const num = (k: string) => {
        const raw = String(formData.get(k) ?? '').replace(',', '.');
        if (raw === '') return null;
        const n = Number(raw);
        return Number.isFinite(n) ? n : null;
      };
      setLogs((prev) => ({
        ...prev,
        [week]: {
          week,
          km: num('km'),
          pain: num('pain'),
          cadence: num('cadence'),
          sleep: num('sleep'),
          palpD: num('palpD'),
          palpI: num('palpI'),
          acwr: acwrResult ? Number(acwrResult.value.toFixed(2)) : (prev[week]?.acwr ?? null),
          notes: String(formData.get('notes') ?? '').trim() || null,
        },
      }));
      showToast('Semana guardada ✓');
    } catch {
      showToast('Sin conexión. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!window.confirm('¿Borrar TODO tu progreso y tus registros? No se puede deshacer.')) return;
    setSaving(true);
    try {
      const result = await resetMyProgress();
      if (!result.ok) {
        showToast(result.error);
        return;
      }
      setLogs(() => ({}));
      window.location.reload();
    } catch {
      showToast('Sin conexión. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  const historyRows = Object.values(logs).sort((a, b) => a.week - b.week);

  return (
    <>
      <div className="card">
        <h3>📊 Calculadora de ACWR</h3>
        <div className="muted" style={{ marginBottom: 10 }}>
          Rellena los km de las últimas 4 semanas. Te dice si puedes subir.
        </div>
        <div className="grid2">
          <Field label="Semana −4">
            <input
              type="number"
              inputMode="decimal"
              placeholder="km"
              value={acwrInput.w1}
              onChange={(e) => setAcwrInput((s) => ({ ...s, w1: e.target.value }))}
            />
          </Field>
          <Field label="Semana −3">
            <input
              type="number"
              inputMode="decimal"
              placeholder="km"
              value={acwrInput.w2}
              onChange={(e) => setAcwrInput((s) => ({ ...s, w2: e.target.value }))}
            />
          </Field>
          <Field label="Semana −2">
            <input
              type="number"
              inputMode="decimal"
              placeholder="km"
              value={acwrInput.w3}
              onChange={(e) => setAcwrInput((s) => ({ ...s, w3: e.target.value }))}
            />
          </Field>
          <Field label="Semana −1">
            <input
              type="number"
              inputMode="decimal"
              placeholder="km"
              value={acwrInput.w4}
              onChange={(e) => setAcwrInput((s) => ({ ...s, w4: e.target.value }))}
            />
          </Field>
        </div>
        <Field label="Semana actual">
          <input
            type="number"
            inputMode="decimal"
            placeholder="km"
            value={acwrInput.current}
            onChange={(e) => setAcwrInput((s) => ({ ...s, current: e.target.value }))}
          />
        </Field>
        <button className="btn btn-primary" type="button" onClick={calculateAcwr}>
          Calcular ACWR
        </button>
        <div className="acwr-out" style={acwrResult ? { color: acwrResult.color } : undefined}>
          {acwrResult ? acwrResult.value.toFixed(2) : '—'}
        </div>
        {acwrResult && (
          <div className="tiny" style={{ textAlign: 'center', marginTop: 4, color: acwrResult.color, fontWeight: 700 }}>
            {acwrResult.label}
          </div>
        )}
      </div>

      <div className="card">
        <h3>📝 Cierre de semana</h3>
        <form action={handleSubmit} key={selectedWeek}>
          <Field label="Semana">
            <select
              name="week"
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(Number(e.target.value))}
            >
              {WEEKS.map((w) => (
                <option key={w.n} value={w.n}>
                  S{w.n} · {formatRange(w.start)}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid2">
            <Field label="Km totales">
              <input name="km" type="number" inputMode="decimal" defaultValue={current?.km ?? ''} />
            </Field>
            <Field label="Dolor máx (0-10)">
              <input name="pain" type="number" inputMode="numeric" defaultValue={current?.pain ?? ''} />
            </Field>
            <Field label="Cadencia (ppm)">
              <input
                name="cadence"
                type="number"
                inputMode="numeric"
                defaultValue={current?.cadence ?? ''}
              />
            </Field>
            <Field label="Sueño medio (h)">
              <input
                name="sleep"
                type="number"
                inputMode="decimal"
                step="0.1"
                defaultValue={current?.sleep ?? ''}
              />
            </Field>
            <Field label="Palpación tibia D (cm)">
              <input
                name="palpD"
                type="number"
                inputMode="decimal"
                step="0.5"
                defaultValue={current?.palpD ?? ''}
              />
            </Field>
            <Field label="Palpación tibia I (cm)">
              <input
                name="palpI"
                type="number"
                inputMode="decimal"
                step="0.5"
                defaultValue={current?.palpI ?? ''}
              />
            </Field>
          </div>

          <input type="hidden" name="acwr" value={acwrResult ? acwrResult.value.toFixed(2) : ''} />

          <Field label="Notas">
            <input name="notes" type="text" placeholder="Cómo ha ido la semana" defaultValue={current?.notes ?? ''} maxLength={500} />
          </Field>

          <button className="btn" type="submit" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar semana'}
          </button>
        </form>
      </div>

      <div className="card">
        <h3>📚 Historial</h3>
        {historyRows.length === 0 ? (
          <div className="muted">Sin registros todavía.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Sem</th>
                <th>Km</th>
                <th>Dolor</th>
                <th>Cad</th>
                <th>Palp</th>
                <th>ACWR</th>
              </tr>
            </thead>
            <tbody>
              {historyRows.map((row) => (
                <tr key={row.week}>
                  <td>
                    <b>S{row.week}</b>
                  </td>
                  <td>{row.km ?? '—'} km</td>
                  <td>{row.pain ?? '—'}/10</td>
                  <td>{row.cadence ?? '—'}</td>
                  <td>
                    {row.palpD ?? '—'}/{row.palpI ?? '—'}
                  </td>
                  <td>{row.acwr ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3>⚙️ Datos</h3>
        <div className="tiny" style={{ marginBottom: 10 }}>
          Tu progreso vive en tu cuenta: entra desde cualquier dispositivo y lo tendrás ahí.
        </div>
        <button
          className="btn"
          type="button"
          onClick={handleReset}
          disabled={saving}
          style={{
            background: 'rgba(239,68,68,.12)',
            color: '#fca5a5',
            borderColor: 'rgba(239,68,68,.3)',
          }}
        >
          Borrar todo mi progreso
        </button>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="fld">
      <label>{label}</label>
      {children}
    </div>
  );
}

function typeClass(type: SessionType): string {
  return `t${type}`;
}
