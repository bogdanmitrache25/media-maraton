/**
 * Datos del plan de 23 semanas.
 *
 * Este módulo es puro: no importa nada de React ni de Supabase, así que puede
 * usarse indistintamente en servidor y en cliente.
 */

export type SessionType = 'A' | 'B' | 'C' | 'G' | 'R' | 'T' | 'Z';

export interface Day {
  /** Tipo de sesión. */
  type: SessionType;
  /** Título corto. */
  title: string;
  /** Descripción o instrucciones. Cadena vacía si no aplica. */
  desc: string;
}

export interface Week {
  /** Número de semana, 1 a 23. */
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
  1: { name: 'Reintroducción y blindaje', color: '#3b82f6', weeks: 'S1 – S4' },
  2: { name: 'Base aeróbica', color: '#22c55e', weeks: 'S5 – S11' },
  3: { name: 'Específico media maratón', color: '#f59e0b', weeks: 'S12 – S18' },
  4: { name: 'Pico y afinado', color: '#ef4444', weeks: 'S19 – S20' },
  5: { name: 'Taper', color: '#eab308', weeks: 'S21 – S22' },
  6: { name: 'Semana de carrera', color: '#a855f7', weeks: 'S23' },
} as const;

export const SESSION_TYPES: Record<SessionType, { label: string; bar: string }> = {
  A: { label: 'LARGA', bar: '#f97316' },
  B: { label: 'CALIDAD', bar: '#ef4444' },
  C: { label: 'CROSS', bar: '#06b6d4' },
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
  G: 'FUERZA',
  R: 'LIBRE',
  T: 'TEST',
  Z: 'CARRERA',
};

/** Intensidad 0-3. Es lo que codifica el color de la regla izquierda. */
export const SESSION_INTENSITY: Record<SessionType, 0 | 1 | 2 | 3> = {
  R: 0,
  C: 1,
  G: 1,
  A: 2,
  B: 2,
  T: 3,
  Z: 3,
};

export const RACE_DATE = '2027-03-14';
export const PLAN_START = '2026-10-05';
export const PLAN_END = '2027-03-14';
export const TOTAL_WEEKS = 23;

const d = (type: SessionType, title: string, desc = ''): Day => ({ type, title, desc });

export const WEEKS: Week[] = [
  {
    n: 1,
    start: '2026-10-05',
    km: '8 km',
    phase: 1,
    focus: 'Empezar y montar el protocolo',
    note: 'Ningún test esta semana. Nada de series fuertes.',
    warn: true,
    days: [
      d('R', '—', 'Semana no iniciada'),
      d('C', 'Bici Z2 · 40 min', 'Hoy: medición basal (palpación tibial) + pedir analítica'),
      d('B', 'Calidad · 3 km', 'Trote continuo RPE 3 + 4×20 s de progresiones'),
      d('C', 'Cinta · 10 % / 4,0 km/h × 20 min'),
      d('G', 'Gym — torso', 'Arranca la rutina sóleo (ejercicios 1, 3, 5, 6)'),
      d('R', 'Descanso total + TB', 'Cuenta tu cadencia durante 30 s'),
      d('A', 'Tirada larga · 5 km', '5×(4 min trote muy suave + 2 min caminata). RPE 3'),
    ],
  },
  {
    n: 2,
    start: '2026-10-12',
    km: '10 km',
    phase: 1,
    focus: 'Igual que S1, un poco más largo',
    days: [
      d('G', 'Gym — pierna pesada'),
      d('C', 'Bici Z2 · 45 min'),
      d('B', 'Calidad · 4 km', 'Trote continuo RPE 3-4 + 4×20 s de progresiones'),
      d('C', 'Cinta · 11 % / 4,0 km/h × 25 min'),
      d('G', 'Gym — torso', 'Rutina sóleo'),
      d('R', 'Descanso total + TB'),
      d('A', 'Tirada larga · 6 km', '6×(4 min trote + 2 min caminata). RPE 3-4'),
    ],
  },
  {
    n: 3,
    start: '2026-10-19',
    km: '12 km',
    phase: 1,
    focus: 'Primera tirada continua sin caminata',
    days: [
      d('G', 'Gym — pierna pesada'),
      d('C', 'Bici Z2 · 50 min'),
      d('B', 'Calidad · 5 km', '2 km fácil + 4×(2 min RPE 5-6 / 2 min fácil) + 1 km fácil'),
      d('C', 'Cinta · 12 % / 4,0 km/h × 30 min'),
      d('G', 'Gym — torso', 'Rutina sóleo 4×/sem'),
      d('R', 'Descanso total + TB', 'Revisa tu calzado: necesitas 2 pares en rotación'),
      d('A', 'Tirada larga · 7 km', 'Rodaje continuo RPE 4 (sin caminata)'),
    ],
  },
  {
    n: 4,
    start: '2026-10-26',
    km: '9 km',
    phase: 1,
    focus: 'Primera descarga',
    note: 'Sin cinta inclinada esta semana. Cierre: repite el test de palpación y calcula el ACWR.',
    days: [
      d('G', 'Gym — pierna ligera'),
      d('C', 'Bici Z2 · 40 min'),
      d('B', 'Calidad · 3,5 km', 'Rodaje suave RPE 3 + 4×20 s de progresiones'),
      d('R', 'Descanso + TB', 'Sin cinta inclinada'),
      d('G', 'Gym — torso'),
      d('R', 'Descanso total + TB'),
      d('A', 'Tirada larga · 5,5 km', 'Rodaje muy suave RPE 3'),
    ],
  },
  {
    n: 5,
    start: '2026-11-02',
    km: '15 km',
    phase: 2,
    focus: 'Construir motor, la carrera crece despacio',
    days: [
      d('G', 'Gym — pierna pesada'),
      d('C', 'Bici Z2 · 60 min'),
      d('B', 'Calidad · 7 km', '2 km fácil + 3×(3 min RPE 6 / 2 min fácil) + 2 km fácil'),
      d('C', 'Cinta · 13 % / 4,0 km/h × 35 min'),
      d('G', 'Gym — torso', 'Empieza el colágeno + vit C 45-60 min antes de las cargas'),
      d('R', 'Descanso total + TB'),
      d('A', 'Tirada larga · 8 km', 'Rodaje continuo Z2. RPE 4'),
    ],
  },
  {
    n: 6,
    start: '2026-11-09',
    km: '17 km',
    phase: 2,
    focus: 'Semana de control',
    note: 'Si aparece cualquier amarillo, en la S7 NO subes volumen.',
    warn: true,
    days: [
      d('G', 'Gym — pierna pesada'),
      d('C', 'Bici Z2 · 60 min'),
      d('B', 'Calidad · 8 km', '3 km fácil + 5×(2 min RPE 6-7 / 90 s fácil) + 1 km fácil'),
      d('C', 'Cinta · 14 % / 4,0 km/h × 35 min'),
      d('G', 'Gym — torso'),
      d('R', 'Descanso total + TB', 'Primera revisión formal del semáforo de dolor'),
      d('A', 'Tirada larga · 9 km', '7 km Z2 + 2 km finales a RPE 5-6'),
    ],
  },
  {
    n: 7,
    start: '2026-11-16',
    km: '18 km',
    phase: 2,
    test: true,
    focus: 'TEST 5K — se recalibra todo',
    note: 'Con el resultado, recalcula toda la tabla de ritmos.',
    days: [
      d('G', 'Gym — pierna ligera', 'Nada pesado: hay test el miércoles'),
      d('R', 'Descanso o bici 30 min muy suave'),
      d(
        'T',
        'TEST DE 5K EN CINTA',
        '15 min calentamiento progresivo + 5K a tope controlado + 10 min enfriamiento',
      ),
      d('R', 'Descanso + TB'),
      d('G', 'Gym — torso'),
      d('R', 'Descanso total'),
      d('A', 'Tirada larga · 10 km', 'Rodaje suave Z2'),
    ],
  },
  {
    n: 8,
    start: '2026-11-23',
    km: '15 km',
    phase: 2,
    focus: 'Descarga',
    days: [
      d('G', 'Gym — pierna ligera'),
      d('C', 'Bici Z2 · 45 min'),
      d('B', 'Calidad · 7 km', '3 km fácil + 6×(1 min RPE 7 / 1 min fácil) + 1 km fácil'),
      d('C', 'Cinta · 10 % / 4,0 km/h × 25 min'),
      d('G', 'Gym — torso'),
      d('R', 'Descanso total + TB + masaje'),
      d('A', 'Tirada larga · 8 km', 'Rodaje suave Z2'),
    ],
  },
  {
    n: 9,
    start: '2026-11-30',
    km: '21 km',
    phase: 2,
    focus: 'Empieza la especificidad: primeros intervalos de verdad',
    days: [
      d('G', 'Gym — pierna pesada'),
      d('C', 'Bici Z2 · 65 min'),
      d('B', 'Calidad · 10 km', '3 km fácil + 3×2000 m RPE 7 (rec 2 min trote) + 1 km fácil'),
      d('C', 'Cinta · 15 % / 4,0 km/h × 40 min'),
      d('G', 'Gym — torso'),
      d('R', 'Descanso total + TB', 'Añade los pogo hops (ejercicio 7). Cadencia objetivo 176'),
      d('A', 'Tirada larga · 11 km', '8 km Z2 + 3 km a RPE 6'),
    ],
  },
  {
    n: 10,
    start: '2026-12-07',
    km: '24 km',
    phase: 2,
    focus: 'Volumen alto de fase 2',
    days: [
      d('G', 'Gym — pierna pesada'),
      d('C', 'Bici Z2 · 70 min'),
      d('B', 'Calidad · 12 km', '3 km fácil + 3×3000 m RPE 7 (rec 2 min) + 1 km fácil'),
      d('C', 'Cinta · 15 % / 4,2 km/h × 45 min'),
      d('G', 'Gym — torso'),
      d('R', 'Descanso total + TB', 'Revisa los km de tus zapatillas'),
      d('A', 'Tirada larga · 12 km', '8 km Z2 + 4 km a ritmo steady (RPE 5)'),
    ],
  },
  {
    n: 11,
    start: '2026-12-14',
    km: '20 km',
    phase: 2,
    focus: 'Descarga (Navidad)',
    note: 'En vacaciones, la rutina tibial es lo ÚLTIMO que se sacrifica. Cuidado con el alcohol.',
    warn: true,
    days: [
      d('G', 'Gym — pierna ligera'),
      d('C', 'Bici Z2 · 45 min'),
      d('B', 'Calidad · 10 km', '3 km fácil + 4×1000 m RPE 6-7 (rec 90 s) + 1 km fácil'),
      d('R', 'Descanso + TB'),
      d('G', 'Gym — torso'),
      d('R', 'Descanso total'),
      d('A', 'Tirada larga · 10 km', 'Rodaje Z2 suave'),
    ],
  },
  {
    n: 12,
    start: '2026-12-21',
    km: '25 km',
    phase: 3,
    focus: 'Primer bloque a ritmo de media maratón',
    days: [
      d('G', 'Gym — pierna pesada'),
      d('C', 'Bici Z2 · 60 min'),
      d('B', 'Calidad · 12 km', '4 km fácil + 4×1500 m RPE 7-8 (rec 2 min) + 1 km fácil'),
      d('C', 'Cinta · 15 % / 4,2 km/h × 45 min'),
      d('G', 'Gym — torso', '(o descanso: es Navidad)'),
      d('R', 'Descanso total + TB', 'Vigila el sueño en fiestas'),
      d('A', 'Tirada larga · 13 km', '8 km Z2 + 5 km a ritmo de media maratón (5:13/km)'),
    ],
  },
  {
    n: 13,
    start: '2026-12-28',
    km: '28 km',
    phase: 3,
    focus: 'Cierre de fiestas',
    days: [
      d('G', 'Gym — pierna pesada'),
      d('C', 'Bici Z2 · 60 min'),
      d('B', 'Calidad · 14 km', '4 km fácil + 2×4000 m RPE 7 (rec 2 min) + 1 km fácil'),
      d('C', 'Cinta · 15 % / 4,2 km/h × 45 min'),
      d('G', 'Gym — torso', '(o descanso)'),
      d('R', 'Descanso total + TB', 'Test de palpación tibial'),
      d('A', 'Tirada larga · 14 km', '8 km Z2 + 6 km a ritmo de media maratón'),
    ],
  },
  {
    n: 14,
    start: '2027-01-04',
    km: '22 km',
    phase: 3,
    test: true,
    focus: 'CHECKPOINT DEL OBJETIVO. Aquí decidimos',
    note: '10K ≤ 49:00 → seguimos a 1:50 · 49-53 → 1:55 · >53 → 2:00-2:05.',
    warn: true,
    days: [
      d('G', 'Gym — pierna ligera'),
      d('R', 'Descanso o bici 30 min muy suave'),
      d(
        'T',
        'TEST DE 10K',
        '15 min calentamiento progresivo + 10K a tope controlado + 10 min enfriamiento',
      ),
      d('R', 'Descanso + TB'),
      d('G', 'Gym — torso', 'Repite analítica (ferritina + vitamina D)'),
      d('R', 'Descanso total'),
      d('A', 'Tirada larga · 9 km', 'Rodaje suave Z2'),
    ],
  },
  {
    n: 15,
    start: '2027-01-11',
    km: '30 km',
    phase: 3,
    focus: 'Primera semana con bloques largos a ritmo de carrera',
    note: 'Si aparece amarillo, corta el bloque de ritmo y termina en Z2.',
    days: [
      d('G', 'Gym — pierna pesada'),
      d('C', 'Bici Z2 · 65 min'),
      d('B', 'Calidad · 15 km', '4 km fácil + 5×2000 m a ritmo umbral (Z4) (rec 90 s) + 2 km fácil'),
      d('C', 'Cinta · 15 % / 4,5 km/h × 45 min'),
      d('G', 'Gym — torso'),
      d('R', 'Descanso total + TB'),
      d('A', 'Tirada larga · 15 km', '8 km Z2 + 7 km a ritmo de media maratón'),
    ],
  },
  {
    n: 16,
    start: '2027-01-18',
    km: '25 km',
    phase: 3,
    focus: 'Descarga',
    days: [
      d('G', 'Gym — pierna ligera'),
      d('C', 'Bici Z2 · 50 min'),
      d('B', 'Calidad · 13 km', '4 km fácil + 6×1000 m a ritmo Z4 (rec 90 s) + 2 km fácil'),
      d('C', 'Cinta · 12 % / 4,2 km/h × 30 min'),
      d('G', 'Gym — torso', 'Revisión de calzado: recambio si un par pasa de 600 km'),
      d('R', 'Descanso total + TB + masaje'),
      d('A', 'Tirada larga · 12 km', 'Rodaje Z2 suave'),
    ],
  },
  {
    n: 17,
    start: '2027-01-25',
    km: '33 km',
    phase: 3,
    focus: 'PICO DE FASE',
    note: 'Semana dura: duerme 8 h, sube proteína a 1,8 g/kg, vigila el semáforo al máximo.',
    warn: true,
    days: [
      d('G', 'Gym — pierna pesada'),
      d('C', 'Bici Z2 · 60 min'),
      d('B', 'Calidad · 16 km', '4 km fácil + 2×5000 m a ritmo de media maratón (rec 3 min) + 2 km fácil'),
      d('C', 'Cinta · 15 % / 4,5 km/h × 45 min'),
      d('G', 'Gym — torso'),
      d('R', 'Descanso total + TB'),
      d(
        'A',
        'Tirada larga · 17 km',
        '10 km Z2 + 7 km a ritmo de media maratón. Puedes estrenar la placa de carbono',
      ),
    ],
  },
  {
    n: 18,
    start: '2027-02-01',
    km: '25 km',
    phase: 3,
    race: true,
    focus: 'Tune-up: aprendes a competir',
    note: 'Practica aquí la rutina completa: desayuno, calentamiento, gel, ritmo.',
    days: [
      d('G', 'Gym — pierna ligera'),
      d('R', 'Descanso o bici 30 min muy suave'),
      d('A', 'Tirada larga · 12 km', 'Rodaje suave Z2 (la tirada se mueve a mitad de semana)'),
      d('R', 'Descanso + TB'),
      d('G', 'Gym — torso ligero'),
      d('R', 'Descanso total', 'Prepara la logística de la carrera'),
      d('Z', 'TUNE-UP — 10K a ritmo de competición', 'Carrera real o simulacro en cinta'),
    ],
  },
  {
    n: 19,
    start: '2027-02-08',
    km: '34 km',
    phase: 4,
    focus: 'PICO 1 — máxima carga del plan',
    note: 'Calcula el ACWR y cuida el sueño. Máxima carga del plan.',
    warn: true,
    days: [
      d('G', 'Gym — pierna pesada'),
      d('C', 'Bici Z2 · 60 min'),
      d('B', 'Calidad · 16 km', '4 km fácil + 4×2000 m a ritmo de media maratón (rec 90 s) + 2 km fácil'),
      d('C', 'Cinta · 15 % / 4,5 km/h × 45 min'),
      d('G', 'Gym — torso'),
      d('R', 'Descanso total + TB'),
      d('A', 'Tirada larga · 18 km', '10 km Z2 + 8 km a ritmo de media maratón — tu tirada más larga'),
    ],
  },
  {
    n: 20,
    start: '2027-02-15',
    km: '29 km',
    phase: 4,
    focus: 'PICO 2 — última semana de carga real',
    note: 'Sin cinta inclinada a partir de esta semana. La prevención pasa a ser gestión de frescura.',
    days: [
      d('G', 'Gym — pierna ligera'),
      d('C', 'Bici Z2 · 50 min', 'Sin cinta inclinada a partir de esta semana'),
      d('B', 'Calidad · 13 km', '4 km fácil + 3×3000 m a ritmo de media maratón (rec 2 min) + 2 km fácil'),
      d('R', 'Descanso o bici suave'),
      d('G', 'Gym — torso ligero'),
      d('R', 'Descanso total + TB'),
      d('A', 'Tirada larga · 16 km', '6 km Z2 + 10 km a ritmo de media maratón (simulacro de media)'),
    ],
  },
  {
    n: 21,
    start: '2027-02-22',
    km: '22 km',
    phase: 5,
    focus: 'TAPER 1 (−35 %)',
    note: 'No estrenes nada: ni zapatillas, ni geles, ni rutinas nuevas.',
    warn: true,
    days: [
      d('G', 'Gym — pierna ligera'),
      d('C', 'Bici Z2 · 40 min'),
      d('B', 'Calidad · 10 km', '4 km fácil + 5×1000 m a ritmo de media maratón (rec 90 s) + 1 km fácil'),
      d('R', 'Descanso + TB'),
      d('G', 'Gym — torso ligero'),
      d('R', 'Descanso total'),
      d('A', 'Tirada larga · 12 km', '6 km Z2 + 4 km a ritmo de media maratón + 2 km fácil'),
    ],
  },
  {
    n: 22,
    start: '2027-03-01',
    km: '15 km',
    phase: 5,
    focus: 'TAPER 2 (−55 %)',
    days: [
      d('R', 'Descanso o gimnasio muy ligero'),
      d('C', 'Bici Z2 · 30 min suave', '(opcional)'),
      d('B', 'Calidad · 6 km', '3 km fácil + 4×400 m a ritmo de media maratón (rec 60 s) + 1 km fácil'),
      d('R', 'Descanso + TB'),
      d('R', 'Descanso total'),
      d('R', 'Descanso total', 'Logística de carrera: dorsal, ropa, geles, plan de viaje'),
      d('A', 'Tirada larga · 9 km', '5 km Z2 + 4 km a ritmo de media maratón'),
    ],
  },
  {
    n: 23,
    start: '2027-03-08',
    km: 'carrera',
    phase: 6,
    focus: 'Semana de carrera',
    note: 'Ritmo objetivo: km 1-3 a 5:25 · km 3-10 a 5:15 · km 10-21,1 a 5:10. Geles: min 30-35, min 65-70 y (opcional) min 95-100.',
    days: [
      d('R', 'Descanso total'),
      d('A', '7 km — activación', '5 km Z2 + 4×100 m de progresiones'),
      d('R', 'Descanso o bici 25 min muy suave', 'Empieza la carga de hidratos (7-8 g/kg/día ≈ 550-620 g/día)'),
      d('B', '6 km — última sesión seria', '4 km Z2 + 2 km a ritmo de media maratón'),
      d('R', 'Descanso total', 'Carga de hidratos al máximo'),
      d('A', 'Activación · 4 km', '4 km muy suaves + 3×100 m a ritmo de media maratón. Prepara todo y duerme bien'),
      d('Z', 'MEDIA MARATÓN — objetivo 1:50:00'),
    ],
  },
];

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
