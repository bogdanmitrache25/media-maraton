/**
 * Datos del plan de 21 semanas.
 *
 * Este módulo es puro: no importa nada de React ni de Supabase, así que puede
 * usarse indistintamente en servidor y en cliente.
 */

import type { GymKey } from '@/lib/gym-data';

export type SessionType = 'A' | 'B' | 'C' | 'E' | 'G' | 'R' | 'T' | 'Z';

export interface Day {
  /** Tipo de sesión. */
  type: SessionType;
  /** Título corto. */
  title: string;
  /** Descripción o instrucciones. Cadena vacía si no aplica. */
  desc: string;
  /** Rutina de gimnasio de ese día. Solo en las sesiones de fuerza. */
  gym?: GymKey;
}

export interface Week {
  /** Número de semana, 1 a 21. */
  n: number;
  /** Lunes de esa semana, en formato ISO (YYYY-MM-DD). */
  start: string;
  /** Volumen de carrera, como texto ("24 km") o "carrera". */
  km: string;
  phase: 1 | 2 | 3 | 4 | 5 | 6;
  /** Foco de la semana. */
  focus: string;
  note?: string;
  warn?: boolean;
  test?: boolean;
  race?: boolean;
  /** 7 días, de lunes a domingo. */
  days: Day[];
}

export const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const;

export const PHASES = {
  1: { name: 'Reintroducción y blindaje', color: '#3b82f6', weeks: 'S1 – S3' },
  2: { name: 'Base aeróbica', color: '#22c55e', weeks: 'S4 – S10' },
  3: { name: 'Específico media maratón', color: '#f59e0b', weeks: 'S11 – S16' },
  4: { name: 'Pico y afinado', color: '#ef4444', weeks: 'S17 – S18' },
  5: { name: 'Taper', color: '#eab308', weeks: 'S19 – S20' },
  6: { name: 'Semana de carrera', color: '#a855f7', weeks: 'S21' },
} as const;

export const SESSION_TYPES: Record<SessionType, { label: string; bar: string }> = {
  A: { label: 'LARGA', bar: '#f97316' },
  B: { label: 'CALIDAD', bar: '#ef4444' },
  C: { label: 'CROSS', bar: '#06b6d4' },
  E: { label: 'FÁCIL', bar: '#84cc16' },
  G: { label: 'GYM', bar: '#8b5cf6' },
  R: { label: 'DESCANSO', bar: '#475569' },
  T: { label: 'TEST', bar: '#eab308' },
  Z: { label: 'CARRERA', bar: '#22c55e' },
};

/**
 * Código tipográfico de cada tipo de sesión. Sustituye a los iconos y a las
 * insignias de color, tanto en la app como en el correo diario.
 */
export const SESSION_CODE: Record<SessionType, string> = {
  A: 'FONDO',
  B: 'CALIDAD',
  C: 'CRUCE',
  E: 'FÁCIL',
  G: 'FUERZA',
  R: 'LIBRE',
  T: 'TEST',
  Z: 'CARRERA',
};

/** Intensidad 0-3. Es lo que codifica el color de la regla izquierda. */
export const SESSION_INTENSITY: Record<SessionType, 0 | 1 | 2 | 3> = {
  R: 0,
  C: 1,
  E: 1,
  G: 1,
  A: 2,
  B: 2,
  T: 3,
  Z: 3,
};

export const RACE_DATE = '2027-03-14';
export const PLAN_START = '2026-10-19';
export const PLAN_END = '2027-03-14';
export const TOTAL_WEEKS = 21;

const d = (type: SessionType, title: string, desc = '', gym?: GymKey): Day =>
  gym ? { type, title, desc, gym } : { type, title, desc };

const addDaysISO = (iso: string, days: number): string => {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const GYM_PUSH = 'Press banca como básico. Nada de fallo.';
const GYM_PULL = 'Peso muerto convencional como básico. Sóleo en las superseries.';
const GYM_LEGS = 'Sentadilla + hip thrust. Sin fallo en tren inferior.';
const REST_TIBIAL = 'Sóleo, tibial posterior y pelota plantar. Nunca justo antes de correr.';

/**
 * Esqueleto fijo de la semana: tres fuerzas, dos carreras cortas y la tirada.
 *
 * Los días de gym no se mueven porque su colocación es lo que protege la
 * carrera: el peso muerto queda 48 h antes de la sentadilla y la sentadilla
 * 48 h antes de la tirada. Lo único que cambia semana a semana es el contenido
 * de las tres carreras.
 */
interface WeekSpec {
  km: string;
  phase: Week['phase'];
  focus: string;
  note?: string;
  warn?: boolean;
  test?: boolean;
  race?: boolean;
  /** Sustituciones puntuales de los días de gym (descargas y semana de carrera). */
  monday?: Day;
  wednesday?: Day;
  friday?: Day;
  quality: Day;
  easy: Day;
  long: Day;
  saturday?: Day;
}

const buildWeek = (spec: WeekSpec, index: number): Week => ({
  n: index + 1,
  start: addDaysISO(PLAN_START, index * 7),
  km: spec.km,
  phase: spec.phase,
  focus: spec.focus,
  ...(spec.note ? { note: spec.note } : {}),
  ...(spec.warn ? { warn: true } : {}),
  ...(spec.test ? { test: true } : {}),
  ...(spec.race ? { race: true } : {}),
  days: [
    spec.monday ?? d('G', 'Gym · push', GYM_PUSH, 'push'),
    spec.quality,
    spec.wednesday ?? d('G', 'Gym · pull', GYM_PULL, 'pull'),
    spec.easy,
    spec.friday ?? d('G', 'Gym · legs', GYM_LEGS, 'legs'),
    spec.saturday ?? d('R', 'Descanso + protocolo tibial', REST_TIBIAL),
    spec.long,
  ],
});

const WEEK_SPECS: WeekSpec[] = [
  {
    km: '8 km',
    phase: 1,
    focus: 'Empezar y montar el protocolo',
    note: 'Ningún test esta semana. Nada de series fuertes.',
    warn: true,
    quality: d(
      'B',
      'Calidad · 3 km',
      'Trote continuo RPE 3 + 4×20 s de progresiones. Nada de series fuertes.',
    ),
    easy: d(
      'E',
      'Carrera fácil · 2 km',
      'Trote muy suave RPE 2-3. Cuenta la cadencia 30 s al minuto 5.',
    ),
    long: d('A', 'Tirada larga · 3 km', 'Trote suave con caminata si hace falta. RPE 3.'),
  },
  {
    km: '12 km',
    phase: 1,
    focus: 'Igual que S1, un poco más largo',
    quality: d(
      'B',
      'Calidad · 4 km',
      '3 km de trote RPE 3-4 + 4×30 s de progresiones (RPE 5-6) + 1 km fácil.',
    ),
    easy: d('E', 'Carrera fácil · 2,5 km', 'Trote Z2. Cadencia 30 s al minuto 5.'),
    long: d('A', 'Tirada larga · 5,5 km', 'Rodaje continuo RPE 4, sin caminata.'),
  },
  {
    km: '12 km',
    phase: 1,
    focus: 'Primera tirada continua sin caminata',
    quality: d(
      'B',
      'Calidad · 4 km',
      '2 km fácil + 6×(1 min RPE 5-6 / 1 min fácil) + 1 km fácil.',
    ),
    easy: d('E', 'Carrera fácil · 2,5 km', 'Trote flojo Z2 + 3×20 s de progresiones.'),
    long: d(
      'A',
      'Tirada larga · 5,5 km',
      'Rodaje continuo RPE 4. Palpación tibial antes de salir.',
    ),
  },
  {
    km: '15 km',
    phase: 2,
    focus: 'Construir motor, la carrera crece despacio',
    quality: d(
      'B',
      'Calidad · 5 km',
      '2 km fácil + 6×(2 min RPE 6 / 1 min fácil) + 1 km fácil.',
    ),
    easy: d('E', 'Carrera fácil · 3 km', 'Trote Z2.'),
    long: d('A', 'Tirada larga · 7 km', 'Rodaje continuo Z2. RPE 4.'),
  },
  {
    km: '17 km',
    phase: 2,
    focus: 'Semana de control',
    note: 'Si aparece cualquier amarillo, en la S6 no subes volumen.',
    quality: d(
      'B',
      'Cuestas en cinta · 5,5 km',
      '2 km fácil + 6×2 min al 8 % (RPE 6-7) con 2 min de trote + 1 km fácil.',
    ),
    easy: d('E', 'Carrera fácil · 3,5 km', 'Trote Z2 + 4×30 s de cadencia alta.'),
    long: d('A', 'Tirada larga · 8 km', 'Rodaje continuo Z2. RPE 4.'),
  },
  {
    km: '18 km',
    phase: 2,
    test: true,
    focus: 'TEST 5K — se recalibra todo',
    note: '5K ≤27:30 → en camino de 1:55 · 27:30-29:00 → 2:00 · >29:00 → 2:05.',
    quality: d(
      'T',
      'TEST DE 5K EN CINTA',
      '15 min de calentamiento progresivo + 5K a tope controlado + 10 min de enfriamiento.',
    ),
    easy: d('E', 'Carrera fácil · 3 km', 'Trote muy suave Z2.'),
    long: d('A', 'Tirada larga · 8 km', 'Rodaje suave Z2.'),
  },
  {
    km: '15 km',
    phase: 2,
    focus: 'Descarga',
    quality: d('B', 'Calidad · 4,5 km', '3 km fácil + 6×(1 min RPE 6 / 1 min fácil).'),
    easy: d('E', 'Carrera fácil · 3 km', 'Trote Z2.'),
    long: d('A', 'Tirada larga · 7,5 km', 'Rodaje Z2 suave.'),
    friday: d(
      'G',
      'Gym · legs',
      'Sentadilla y hip thrust ligeros: 2 series a RPE 6. Nada de fallo.',
      'legs',
    ),
  },
  {
    km: '21 km',
    phase: 2,
    focus: 'Empieza la especificidad: primeros intervalos de verdad',
    quality: d(
      'B',
      'Calidad · 6,5 km',
      '2 km fácil + 4×1000 m RPE 6-7 (rec 90 s) + 1,5 km fácil.',
    ),
    easy: d('E', 'Carrera fácil · 4 km', 'Trote Z2 + 3×20 s de progresiones.'),
    long: d('A', 'Tirada larga · 10,5 km', '8 km Z2 + 2,5 km a RPE 5-6.'),
  },
  {
    km: '24 km',
    phase: 2,
    focus: 'Volumen alto de fase 2',
    quality: d(
      'B',
      'Calidad · 7 km',
      '2 km fácil + 3×2000 m RPE 6-7 (rec 2 min) + 1 km fácil.',
    ),
    easy: d('E', 'Carrera fácil · 4,5 km', 'Trote Z2. Cadencia objetivo 172-176.'),
    long: d('A', 'Tirada larga · 12,5 km', '9 km Z2 + 3,5 km a RPE 5-6.'),
  },
  {
    km: '20 km',
    phase: 2,
    focus: 'Descarga (Navidad)',
    note: 'En vacaciones, la rutina tibial es lo último que se sacrifica. Cuidado con el alcohol.',
    warn: true,
    quality: d(
      'B',
      'Calidad · 6 km',
      '2 km fácil + 5×(2 min RPE 6 / 90 s fácil) + 1 km fácil.',
    ),
    easy: d('E', 'Carrera fácil · 4 km', 'Trote Z2 suave.'),
    long: d('A', 'Tirada larga · 10 km', 'Rodaje Z2 suave.'),
    friday: d(
      'G',
      'Gym · legs',
      'Sentadilla y hip thrust ligeros: 2 series a RPE 6. Nada de fallo.',
      'legs',
    ),
  },
  {
    km: '25 km',
    phase: 3,
    focus: 'Primer bloque a ritmo de media maratón',
    quality: d(
      'B',
      'Calidad · 8 km',
      '2 km fácil + 4×1500 m a ritmo objetivo 5:35 (rec 2 min) + 1,5 km fácil.',
    ),
    easy: d('E', 'Carrera fácil · 5 km', 'Trote Z2 + 4×30 s de cadencia alta.'),
    long: d('A', 'Tirada larga · 12 km', '8 km Z2 + 4 km a 5:35.'),
  },
  {
    km: '22 km',
    phase: 3,
    test: true,
    focus: 'CHECKPOINT: aquí decidimos',
    note: '10K ≤54:00 → 1:55 · 54-57 → 1:58-2:00 · >57 → 2:05.',
    warn: true,
    quality: d(
      'T',
      'TEST DE 10K',
      '15 min de calentamiento progresivo + 10K a tope controlado + 10 min de enfriamiento.',
    ),
    easy: d('E', 'Carrera fácil · 3 km', 'Trote muy suave Z2.'),
    long: d('A', 'Tirada larga · 7 km', 'Rodaje suave Z2.'),
  },
  {
    km: '30 km',
    phase: 3,
    focus: 'Primera semana con bloques largos a ritmo de carrera',
    note: 'Si aparece amarillo, corta el bloque de ritmo y termina en Z2.',
    quality: d(
      'B',
      'Calidad · 9 km',
      '3 km fácil + 3×2000 m a 5:35 (rec 2 min) + 1,5 km fácil.',
    ),
    easy: d('E', 'Carrera fácil · 6 km', 'Trote Z2.'),
    long: d('A', 'Tirada larga · 15 km', '9 km Z2 + 6 km a 5:35.'),
  },
  {
    km: '25 km',
    phase: 3,
    focus: 'Descarga',
    quality: d(
      'B',
      'Cuestas en cinta · 7 km',
      '2 km fácil + 6×60 s al 10 % (RPE 7) con 90 s de trote + 1 km fácil.',
    ),
    easy: d('E', 'Carrera fácil · 5 km', 'Trote Z2.'),
    long: d('A', 'Tirada larga · 13 km', 'Rodaje Z2 suave.'),
    friday: d(
      'G',
      'Gym · legs',
      'Sentadilla y hip thrust ligeros: 2 series a RPE 6. Nada de fallo.',
      'legs',
    ),
  },
  {
    km: '33 km',
    phase: 3,
    focus: 'PICO DE FASE',
    note: 'Semana dura: duerme 8 h, sube proteína a 1,8 g/kg y vigila el semáforo al máximo.',
    warn: true,
    quality: d(
      'B',
      'Calidad · 10 km',
      '3 km fácil + 3×2500 m a 5:35 (rec 2 min) + 1 km fácil.',
    ),
    easy: d('E', 'Carrera fácil · 6 km', 'Trote Z2 + 4×30 s de cadencia alta.'),
    long: d('A', 'Tirada larga · 17 km', '10 km Z2 + 7 km a 5:35.'),
  },
  {
    km: '22 km',
    phase: 3,
    race: true,
    focus: 'Tune-up: aprendes a competir',
    note: 'Practica aquí la rutina completa: desayuno, calentamiento, gel y ritmo.',
    quality: d(
      'B',
      'Calidad · 6 km',
      '3 km fácil + 4×500 m a 5:35 (rec 60 s) + 1 km fácil.',
    ),
    easy: d('E', 'Carrera fácil · 4 km', 'Trote Z2 suave.'),
    saturday: d(
      'R',
      'Descanso total',
      'Prepara la logística de la carrera: dorsal, ropa y geles.',
    ),
    long: d(
      'Z',
      'TUNE-UP — 10K a ritmo de competición',
      'Carrera real o simulacro. Calienta 15 min y practica el gel.',
    ),
  },
  {
    km: '34 km',
    phase: 4,
    focus: 'PICO 1 — máxima carga del plan',
    note: 'Calcula el ACWR y cuida el sueño. Máxima carga del plan.',
    warn: true,
    quality: d(
      'B',
      'Calidad · 10,5 km',
      '3 km fácil + 2×4000 m a 5:35 (rec 3 min) + 1,5 km fácil.',
    ),
    easy: d('E', 'Carrera fácil · 6,5 km', 'Trote Z2.'),
    long: d(
      'A',
      'Tirada larga · 17 km',
      '10 km Z2 + 7 km a 5:35 — tu tirada más larga.',
    ),
  },
  {
    km: '29 km',
    phase: 4,
    focus: 'PICO 2 — última semana de carga real',
    note: 'Sin cinta inclinada a partir de esta semana. La prevención pasa a ser gestión de frescura.',
    quality: d(
      'B',
      'Calidad · 9 km',
      '3 km fácil + 2×3000 m a 5:35 (rec 2 min) + 1 km fácil.',
    ),
    easy: d('E', 'Carrera fácil · 5 km', 'Trote Z2.'),
    long: d('A', 'Tirada larga · 15 km', '6 km Z2 + 9 km a 5:35 — simulacro de media.'),
  },
  {
    km: '22 km',
    phase: 5,
    focus: 'TAPER 1 (−35 %)',
    note: 'No estrenes nada: ni zapatillas, ni geles, ni rutinas nuevas.',
    warn: true,
    quality: d(
      'B',
      'Calidad · 7 km',
      '3 km fácil + 2×1500 m a 5:35 (rec 90 s) + 1 km fácil.',
    ),
    easy: d('E', 'Carrera fácil · 4 km', 'Trote Z2 + 3×20 s de progresiones.'),
    long: d('A', 'Tirada larga · 11 km', '6 km Z2 + 5 km a 5:35.'),
    friday: d(
      'G',
      'Gym · legs',
      'Sentadilla ligera: 2×5 a RPE 6. Nada de fallo.',
      'legs',
    ),
  },
  {
    km: '15 km',
    phase: 5,
    focus: 'TAPER 2 (−55 %)',
    quality: d(
      'B',
      'Calidad · 4 km',
      '2 km fácil + 4×400 m a 5:35 (rec 60 s) + 1 km fácil.',
    ),
    easy: d('E', 'Carrera fácil · 3 km', 'Trote Z2 suave.'),
    long: d('A', 'Tirada larga · 8 km', '5 km Z2 + 3 km a 5:35.'),
    monday: d(
      'G',
      'Gym · push',
      'Series de aproximación, sin buscar récords. 20-25 min.',
      'push',
    ),
    wednesday: d(
      'G',
      'Gym · pull',
      'Peso muerto ligero: 2×5 a RPE 6. Nada de fallo.',
      'pull',
    ),
    friday: d(
      'G',
      'Gym · legs',
      'Sentadilla ligera: 2×5 a RPE 6. Nada de fallo.',
      'legs',
    ),
  },
  {
    km: 'carrera',
    phase: 6,
    focus: 'Semana de carrera',
    note: 'Ritmo objetivo: km 1-3 a 5:50 · km 3-10 a 5:40 · km 10-21,1 a 5:30-5:35. Geles: min 30-35, 65-70 y (opcional) 95-100.',
    monday: d('R', 'Descanso total'),
    quality: d('A', '7 km — activación', '5 km Z2 + 4×100 m de progresiones.'),
    wednesday: d(
      'R',
      'Descanso o bici 25 min muy suave',
      'Empieza la carga de hidratos (7-8 g/kg/día ≈ 550-620 g/día).',
    ),
    easy: d('B', '6 km — última sesión seria', '4 km Z2 + 2 km a ritmo objetivo.'),
    friday: d('R', 'Descanso total', 'Carga de hidratos al máximo.'),
    saturday: d(
      'A',
      'Activación · 4 km',
      '4 km muy suaves + 3×100 m a ritmo de media. Prepara todo y duerme bien.',
    ),
    long: d(
      'Z',
      'MEDIA MARATÓN — objetivo 1:55:00',
      'Sal a 5:50 y baja a 5:30-5:35. Si el día no acompaña, 2:00 también es un gran resultado.',
    ),
  },
];

/* -------------------------------------------------------------------------- */
/*  Calendario definitivo                                                     */
/* -------------------------------------------------------------------------- */

export const WEEKS: Week[] = WEEK_SPECS.map(buildWeek);

/* -------------------------------------------------------------------------- */
/*  Utilidades                                                                */
/* -------------------------------------------------------------------------- */

/** Una sesión cuenta para el progreso si no es un día de descanso. */
export const isCountable = (type: SessionType) => type !== 'R';

const toISO = (date: Date) => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** Fecha ISO del día `dayIndex` (0 = lunes) de la semana `week`. */
export function dateOf(week: number, dayIndex: number): string {
  const w = WEEKS.find((x) => x.n === week);
  if (!w) return '';
  const base = new Date(`${w.start}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() + dayIndex);
  return toISO(base);
}

/** Último día (domingo) de la semana, en ISO. */
export function weekEnd(week: number): string {
  return dateOf(week, 6);
}

/** Formatea un rango "5 oct – 11 oct" a partir del lunes. */
export function formatRange(startISO: string): string {
  const a = new Date(`${startISO}T12:00:00Z`);
  const b = new Date(a.getTime() + 6 * 86400000);
  const f = (date: Date) =>
    date
      .toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' })
      .replace(/\./g, '');
  return `${f(a)} – ${f(b)}`;
}

/** Número de sesiones contables de una semana. */
export const weekTotal = (w: Week) => w.days.filter((day) => isCountable(day.type)).length;

/** Semana que contiene una fecha ISO dada, o `null`. */
export function weekOfDate(iso: string): Week | null {
  return WEEKS.find((w) => w.start <= iso && iso <= weekEnd(w.n)) ?? null;
}

/** Índice de día (0-6) de una fecha ISO dentro de su semana. */
export function dayIndexIn(week: Week, iso: string): number {
  for (let i = 0; i < 7; i++) if (dateOf(week.n, i) === iso) return i;
  return -1;
}

/** Clave única de una sesión, la que se guarda en base de datos. */
export const sessionKey = (week: number, day: number) => `${week}:${day}`;
