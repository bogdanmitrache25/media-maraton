'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { deleteMeal, saveBodyMetric, saveMeal } from '@/app/progreso/actions';

export interface BodyMetricRow {
  id: string;
  measuredOn: string;
  weightKg: number | null;
  bodyFatPct: number | null;
  muscleMassKg: number | null;
  waterPct: number | null;
  visceralFat: number | null;
  boneMassKg: number | null;
  bmrKcal: number | null;
  waistCm: number | null;
  hipCm: number | null;
  chestCm: number | null;
  thighCm: number | null;
  armCm: number | null;
  calfCm: number | null;
  notes: string | null;
}

export interface MealRow {
  id: string;
  eatenAt: string;
  description: string;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  source: string;
}

export interface PhotoRow {
  id: string;
  takenOn: string;
  view: string;
  notes: string | null;
  url: string | null;
}

interface Props {
  name: string;
  today: string;
  initialMetrics: BodyMetricRow[];
  initialMeals: MealRow[];
  initialPhotos: PhotoRow[];
  initialTab?: Tab;
  photoPage?: number;
  hasMorePhotos?: boolean;
}

type Tab = 'resumen' | 'comidas' | 'fotos';

const nf = (v: number | null, digits = 1) =>
  v == null ? '—' : v.toFixed(digits).replace('.', ',');

const dateLabel = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
  });

const dateTimeLabel = (iso: string) =>
  new Date(iso).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

const localDay = (iso: string) => new Date(iso).toLocaleDateString('en-CA');

const nowLocalInput = () => {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

const deltaLabel = (a: number | null, b: number | null, unit: string, digits = 1) => {
  if (a == null || b == null) return null;
  const diff = a - b;
  const sign = diff > 0 ? '+' : '';
  return `${sign}${diff.toFixed(digits).replace('.', ',')} ${unit}`;
};

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) {
    return <p className="soft prog-empty">Necesitas al menos dos pesajes para ver la tendencia.</p>;
  }

  const w = 320;
  const h = 72;
  const pad = 6;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = pad + (i * (w - pad * 2)) / (values.length - 1);
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return [x, y] as const;
  });
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1]!;

  return (
    <svg className="prog-spark" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Tendencia de peso">
      <polyline points={line} fill="none" stroke="var(--signal)" strokeWidth="2" />
      <circle cx={last[0]} cy={last[1]} r="3.5" fill="var(--signal)" />
    </svg>
  );
}

function Stat({
  label,
  value,
  unit,
  delta,
}: {
  label: string;
  value: string;
  unit: string;
  delta: string | null;
}) {
  return (
    <div className="prog-stat">
      <p className="eyebrow">{label}</p>
      <p className="prog-stat-value">
        {value}
        <span>{unit}</span>
      </p>
      {delta && <p className="prog-delta">{delta}</p>}
    </div>
  );
}

export function ProgressApp({
  name,
  today,
  initialMetrics,
  initialMeals,
  initialPhotos,
  initialTab = 'resumen',
  photoPage = 1,
  hasMorePhotos = false,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [toast, setToast] = useState<string | null>(null);
  const [savingMetric, setSavingMetric] = useState(false);
  const [savingMeal, setSavingMeal] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const metrics = useMemo(
    () => [...initialMetrics].sort((a, b) => b.measuredOn.localeCompare(a.measuredOn)),
    [initialMetrics],
  );
  const meals = useMemo(
    () => [...initialMeals].sort((a, b) => b.eatenAt.localeCompare(a.eatenAt)),
    [initialMeals],
  );

  const latest = metrics[0] ?? null;
  const previous = metrics[1] ?? null;
  const weightSeries = metrics
    .slice(0, 30)
    .reverse()
    .map((m) => m.weightKg)
    .filter((v): v is number => v != null);

  const day = new Date().toLocaleDateString('en-CA');
  const todayMeals = meals.filter((m) => localDay(m.eatenAt) === day);
  const totals = todayMeals.reduce(
    (acc, m) => ({
      kcal: acc.kcal + (m.calories ?? 0),
      protein: acc.protein + (m.proteinG ?? 0),
      carbs: acc.carbs + (m.carbsG ?? 0),
      fat: acc.fat + (m.fatG ?? 0),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2800);
  }

  async function handleMetric(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingMetric) return;
    setSavingMetric(true);
    const result = await saveBodyMetric(new FormData(event.currentTarget));
    setSavingMetric(false);
    if (result.ok) {
      showToast('Medición guardada.');
      router.refresh();
    } else {
      showToast(result.error);
    }
  }

  async function handleMeal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingMeal) return;
    setSavingMeal(true);
    const form = event.currentTarget;
    const result = await saveMeal(new FormData(form));
    setSavingMeal(false);
    if (result.ok) {
      form.reset();
      showToast('Comida guardada.');
      router.refresh();
    } else {
      showToast(result.error);
    }
  }

  async function handleDelete(id: string) {
    if (deleting) return;
    setDeleting(id);
    const result = await deleteMeal(id);
    setDeleting(null);
    if (result.ok) {
      showToast('Comida borrada.');
      router.refresh();
    } else {
      showToast(result.error);
    }
  }

  return (
    <div className="prog-shell">
      <header className="prog-head">
        <div>
          <p className="eyebrow">Progreso · {name}</p>
          <h1 className="prog-title">Tu evolución</h1>
        </div>
        <a className="prog-back" href="/plan">
          ← Plan
        </a>
      </header>

      <div className="seg prog-tabs" role="tablist" aria-label="Secciones de progreso">
        {(
          [
            ['resumen', 'Resumen'],
            ['comidas', 'Comidas'],
            ['fotos', 'Fotos'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'resumen' && (
        <>
          <section className="sect">
            {latest ? (
              <>
                <div className="hero">
                  <p className="eyebrow">Peso actual · {dateLabel(latest.measuredOn)}</p>
                  <p className="hero-title">
                    {nf(latest.weightKg)}
                    <small> kg</small>
                  </p>
                  <p className="hero-meta">
                    Grasa {nf(latest.bodyFatPct)}% · Músculo {nf(latest.muscleMassKg)} kg · Cintura{' '}
                    {nf(latest.waistCm)} cm
                  </p>
                </div>

                <div className="prog-stats">
                  <Stat
                    label="Peso"
                    value={nf(latest.weightKg)}
                    unit="kg"
                    delta={deltaLabel(latest.weightKg, previous?.weightKg ?? null, 'kg')}
                  />
                  <Stat
                    label="Grasa"
                    value={nf(latest.bodyFatPct)}
                    unit="%"
                    delta={deltaLabel(latest.bodyFatPct, previous?.bodyFatPct ?? null, '%')}
                  />
                  <Stat
                    label="Músculo"
                    value={nf(latest.muscleMassKg)}
                    unit="kg"
                    delta={deltaLabel(latest.muscleMassKg, previous?.muscleMassKg ?? null, 'kg')}
                  />
                  <Stat
                    label="Cintura"
                    value={nf(latest.waistCm)}
                    unit="cm"
                    delta={deltaLabel(latest.waistCm, previous?.waistCm ?? null, 'cm')}
                  />
                </div>

                <div className="prog-card">
                  <div className="sect-head">
                    <p className="eyebrow">Tendencia de peso</p>
                    <span className="soft num">
                      {weightSeries.length ? `${weightSeries.length} pesajes` : ''}
                    </span>
                  </div>
                  <Sparkline values={weightSeries} />
                </div>
              </>
            ) : (
              <div className="hero">
                <p className="eyebrow">Punto de partida</p>
                <p className="hero-title">
                  Primer
                  <br />
                  pesaje
                </p>
                <p className="hero-meta">
                  Añade tu peso y tus medidas de BodyTrax para empezar a ver la evolución.
                </p>
              </div>
            )}

            <details className="prog-details" open={!latest}>
              <summary>Añadir o actualizar medición</summary>
              <form onSubmit={handleMetric} method="post" noValidate>
                <div className="grid2">
                  <div className="field">
                    <label htmlFor="measuredOn">Fecha</label>
                    <input
                      id="measuredOn"
                      name="measuredOn"
                      className="input"
                      type="date"
                      defaultValue={today}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="weightKg">Peso (kg)</label>
                    <input
                      id="weightKg"
                      name="weightKg"
                      className="input"
                      inputMode="decimal"
                      placeholder="82,5"
                      defaultValue={latest?.weightKg ?? ''}
                    />
                  </div>
                </div>

                <div className="grid2">
                  <div className="field">
                    <label htmlFor="bodyFatPct">Grasa (%)</label>
                    <input
                      id="bodyFatPct"
                      name="bodyFatPct"
                      className="input"
                      inputMode="decimal"
                      defaultValue={latest?.bodyFatPct ?? ''}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="muscleMassKg">Masa muscular (kg)</label>
                    <input
                      id="muscleMassKg"
                      name="muscleMassKg"
                      className="input"
                      inputMode="decimal"
                      defaultValue={latest?.muscleMassKg ?? ''}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="waterPct">Agua (%)</label>
                    <input
                      id="waterPct"
                      name="waterPct"
                      className="input"
                      inputMode="decimal"
                      defaultValue={latest?.waterPct ?? ''}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="visceralFat">Grasa visceral</label>
                    <input
                      id="visceralFat"
                      name="visceralFat"
                      className="input"
                      inputMode="decimal"
                      defaultValue={latest?.visceralFat ?? ''}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="boneMassKg">Masa ósea (kg)</label>
                    <input
                      id="boneMassKg"
                      name="boneMassKg"
                      className="input"
                      inputMode="decimal"
                      defaultValue={latest?.boneMassKg ?? ''}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="bmrKcal">Metabolismo basal (kcal)</label>
                    <input
                      id="bmrKcal"
                      name="bmrKcal"
                      className="input"
                      inputMode="numeric"
                      defaultValue={latest?.bmrKcal ?? ''}
                    />
                  </div>
                </div>

                <p className="eyebrow" style={{ margin: '8px 0 12px' }}>
                  Medidas de cinta (cm)
                </p>
                <div className="grid2">
                  <div className="field">
                    <label htmlFor="waistCm">Cintura</label>
                    <input id="waistCm" name="waistCm" className="input" inputMode="decimal" defaultValue={latest?.waistCm ?? ''} />
                  </div>
                  <div className="field">
                    <label htmlFor="hipCm">Cadera</label>
                    <input id="hipCm" name="hipCm" className="input" inputMode="decimal" defaultValue={latest?.hipCm ?? ''} />
                  </div>
                  <div className="field">
                    <label htmlFor="chestCm">Pecho</label>
                    <input id="chestCm" name="chestCm" className="input" inputMode="decimal" defaultValue={latest?.chestCm ?? ''} />
                  </div>
                  <div className="field">
                    <label htmlFor="thighCm">Muslo</label>
                    <input id="thighCm" name="thighCm" className="input" inputMode="decimal" defaultValue={latest?.thighCm ?? ''} />
                  </div>
                  <div className="field">
                    <label htmlFor="armCm">Brazo</label>
                    <input id="armCm" name="armCm" className="input" inputMode="decimal" defaultValue={latest?.armCm ?? ''} />
                  </div>
                  <div className="field">
                    <label htmlFor="calfCm">Gemelo</label>
                    <input id="calfCm" name="calfCm" className="input" inputMode="decimal" defaultValue={latest?.calfCm ?? ''} />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="notes">Notas</label>
                  <input
                    id="notes"
                    name="notes"
                    className="input"
                    placeholder="Condiciones, sensaciones, etc."
                    maxLength={500}
                  />
                </div>

                <button className="btn btn-solid" type="submit" disabled={savingMetric}>
                  {savingMetric ? 'Guardando…' : 'Guardar medición'}
                </button>
              </form>
            </details>

            {metrics.length > 0 && (
              <div className="prog-table-wrap">
                <table className="kv">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Peso</th>
                      <th>Grasa</th>
                      <th>Músculo</th>
                      <th>Cintura</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.slice(0, 12).map((m) => (
                      <tr key={m.id}>
                        <td>{dateLabel(m.measuredOn)}</td>
                        <td>{nf(m.weightKg)}</td>
                        <td>{nf(m.bodyFatPct)}%</td>
                        <td>{nf(m.muscleMassKg)}</td>
                        <td>{nf(m.waistCm)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {tab === 'comidas' && (
        <section className="sect">
          <div className="prog-stats">
            <Stat label="Hoy" value={String(totals.kcal)} unit="kcal" delta={null} />
            <Stat label="Proteína" value={nf(totals.protein)} unit="g" delta={null} />
            <Stat label="Carbos" value={nf(totals.carbs)} unit="g" delta={null} />
            <Stat label="Grasa" value={nf(totals.fat)} unit="g" delta={null} />
          </div>

          <details className="prog-details" open>
            <summary>Añadir comida</summary>
            <form onSubmit={handleMeal} method="post" noValidate>
              <div className="grid2">
                <div className="field">
                  <label htmlFor="eatenAt">Cuándo</label>
                  <input
                    id="eatenAt"
                    name="eatenAt"
                    className="input"
                    type="datetime-local"
                    defaultValue={nowLocalInput()}
                  />
                </div>
                <div className="field">
                  <label htmlFor="calories">Calorías (opcional)</label>
                  <input id="calories" name="calories" className="input" inputMode="numeric" placeholder="650" />
                </div>
              </div>

              <div className="field">
                <label htmlFor="description">Qué has comido</label>
                <input
                  id="description"
                  name="description"
                  className="input"
                  placeholder="Pollo con arroz y ensalada"
                  maxLength={500}
                  required
                />
              </div>

              <div className="grid2">
                <div className="field">
                  <label htmlFor="proteinG">Proteína (g)</label>
                  <input id="proteinG" name="proteinG" className="input" inputMode="decimal" />
                </div>
                <div className="field">
                  <label htmlFor="carbsG">Carbos (g)</label>
                  <input id="carbsG" name="carbsG" className="input" inputMode="decimal" />
                </div>
                <div className="field">
                  <label htmlFor="fatG">Grasa (g)</label>
                  <input id="fatG" name="fatG" className="input" inputMode="decimal" />
                </div>
              </div>

              <button className="btn btn-solid" type="submit" disabled={savingMeal}>
                {savingMeal ? 'Guardando…' : 'Guardar comida'}
              </button>
            </form>
          </details>

          <p className="eyebrow" style={{ marginTop: 22 }}>
            Últimas comidas
          </p>
          {meals.length === 0 ? (
            <p className="soft prog-empty">
              Todavía no hay comidas. Puedes añadirlas aquí o mandarlas por Telegram.
            </p>
          ) : (
            <ul className="prog-meals">
              {meals.slice(0, 40).map((m) => (
                <li key={m.id} className="prog-meal">
                  <div className="prog-meal-main">
                    <p className="prog-meal-title">{m.description}</p>
                    <p className="prog-meal-meta">
                      {dateTimeLabel(m.eatenAt)}
                      {m.source === 'telegram' ? ' · Telegram' : ''}
                      {m.calories != null ? ` · ${m.calories} kcal` : ''}
                      {m.proteinG != null ? ` · P ${nf(m.proteinG)} g` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="prog-meal-del"
                    onClick={() => handleDelete(m.id)}
                    disabled={deleting === m.id}
                    aria-label="Borrar comida"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'fotos' && (
        <section className="sect">
          <p className="eyebrow">Fotos de progreso</p>
          <p className="soft prog-empty" style={{ marginBottom: 16 }}>
            Se guardan en el servidor de casa, en un bucket privado. Mándalas por Telegram con la
            vista en el pie de foto: <b>frente</b>, <b>lado</b> o <b>espalda</b>.
          </p>

          {initialPhotos.length === 0 ? (
            <div className="prog-card">
              <p className="soft">
                {photoPage > 1 ? 'No hay más fotos en esta página.' : 'Todavía no hay fotos.'}
              </p>
            </div>
          ) : (
            <div className="prog-photos">
              {initialPhotos.map((p) => (
                <figure key={p.id} className="prog-photo">
                  {p.url ? (
                    <a href={p.url} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt={`Foto ${p.view} del ${dateLabel(p.takenOn)}`} />
                    </a>
                  ) : (
                    <div className="prog-photo-missing">Sin URL</div>
                  )}
                  <figcaption>
                    {dateLabel(p.takenOn)} · {p.view}
                    {p.notes ? ` · ${p.notes}` : ''}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}

          {(photoPage > 1 || hasMorePhotos) && (
            <nav className="prog-pager" aria-label="Paginación de fotos">
              {photoPage > 1 ? (
                <Link href={`/progreso?tab=fotos&photoPage=${photoPage - 1}`}>Más recientes</Link>
              ) : (
                <span />
              )}
              <span>Página {photoPage}</span>
              {hasMorePhotos ? (
                <Link href={`/progreso?tab=fotos&photoPage=${photoPage + 1}`}>Más antiguas</Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </section>
      )}

      <div className={`toast ${toast ? 'on' : ''}`} role="status" aria-live="polite">
        {toast}
      </div>
    </div>
  );
}
