/**
 * Programa de fuerza en tres sesiones: push, pull y legs.
 *
 * Sale de fusionar las cuatro sesiones anteriores (Push A/B, Pull A/B). El peso
 * muerto pasa a pull y la sentadilla a legs, de modo que el tren inferior se
 * reparte en dos días y no queda un día de pierna que arruine la carrera.
 *
 * Los básicos abren su sesión (top set + back-offs) y nunca se llevan al fallo.
 * Las prescripciones se mantienen en el formato literal de siempre.
 */

export type GymKey = 'push' | 'pull' | 'legs';

export interface GymBlock {
  /** Ejercicio principal del bloque. */
  name: string;
  /** Prescripción literal: series × repes y, si aplica, el top set. */
  prescription: string;
  /** Descanso entre series del bloque. */
  rest?: string;
  /** Segundo ejercicio de la superserie. */
  paired?: string;
  /** Prescripción del segundo ejercicio, cuando no es la misma. */
  pairedPrescription?: string;
}

export interface GymSession {
  key: GymKey;
  label: string;
  blocks: GymBlock[];
}

/** Recordatorio que acompaña a todas las sesiones durante el bloque de carrera. */
export const GYM_PHASE_NOTE =
  'En esta fase: el básico con top set y back-offs, accesorios a RPE 8 y nada de fallo en tren inferior. Los kilómetros los pone la carrera.';

export const GYM_SESSIONS: Record<GymKey, GymSession> = {
  push: {
    key: 'push',
    label: 'Push · press banca',
    blocks: [
      {
        name: 'Press banca',
        prescription: '1×3-5 TS + 2×6-8',
        rest: '3:00',
        paired: 'Flexión de muñeca en polea',
        pairedPrescription: '3×12-15',
      },
      {
        name: 'Press inclinado mancuernas, bajando bien',
        prescription: '3×8-10',
        rest: '2:30',
        paired: 'Elevaciones laterales en polea, muñequeras',
        pairedPrescription: '3×12-15',
      },
      {
        name: 'Press militar máquina',
        prescription: '3×8-12',
        rest: '2:00',
        paired: 'Contractora pecho',
        pairedPrescription: '2×10-12',
      },
      {
        name: 'Extensiones tríceps polea estrecha con muñequeras',
        prescription: '3×10-12',
        rest: '2:00',
        paired: 'Elevaciones laterales máquina',
        pairedPrescription: '2×12-15',
      },
    ],
  },

  pull: {
    key: 'pull',
    label: 'Pull · peso muerto',
    blocks: [
      {
        name: 'Peso muerto convencional',
        prescription: '1×3-5 TS + 2×5',
        rest: '3:00',
        paired: 'Sóleo ROM completo, excéntrica 2 s',
        pairedPrescription: '3×12-15 · 2:00',
      },
      {
        name: 'Dominadas neutras con lastre',
        prescription: '1×3-5 TS + 2×8-10',
        rest: '3:00',
        paired: 'Peck fly invertido',
        pairedPrescription: '3×12-15',
      },
      {
        name: 'Remo gironda neutro unilateral, pecho apoyado',
        prescription: '3×8-12',
        rest: '2:30',
        paired: 'Encogimiento de hombros',
        pairedPrescription: '2×12-15',
      },
      {
        name: 'Curl de bíceps en banco inclinado',
        prescription: '3×8-12',
        rest: '2:00',
        paired: 'Curl martillo',
        pairedPrescription: '2×10-12',
      },
      {
        name: 'Abs en polea, crunch + oblicuo',
        prescription: '3×10-12 / 2×10-12',
        rest: '1:30',
      },
    ],
  },

  legs: {
    key: 'legs',
    label: 'Legs · sentadilla',
    blocks: [
      {
        name: 'Sentadilla libre',
        prescription: '1×4-5 TS + 2×6-8',
        rest: '3:00',
        paired: 'Aducción sentado',
        pairedPrescription: '2×12-15',
      },
      {
        name: 'Hip thrust',
        prescription: '1×6-8 TS + 2×8-10',
        rest: '2:30',
        paired: 'Sóleo ROM completo, excéntrica 2 s',
        pairedPrescription: '3×12-15 · 2:00',
      },
      {
        name: 'Prensa plana (o hack)',
        prescription: '3×10-12',
        rest: '2:00',
        paired: 'Curl femoral sentado',
        pairedPrescription: '3×10-12',
      },
      {
        name: 'Extensiones de cuádriceps',
        prescription: '2×12-15',
        rest: '1:30',
        paired: 'Abducción sentado',
        pairedPrescription: '2×12-15',
      },
      {
        name: 'Gemelo multi, rango completo con rebote',
        prescription: '3×10-12',
        rest: '1:30',
        paired: 'Planchas',
        pairedPrescription: '3×45-60 s',
      },
    ],
  },
};
