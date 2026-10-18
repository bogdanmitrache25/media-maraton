/**
 * Tu programa de fuerza, tal como lo escribiste.
 *
 * Vive aparte de `plan-data` porque cambia con otra frecuencia: el plan de
 * carrera es fijo durante 21 semanas y esto lo ajustas tú. El correo diario lee
 * de aquí cuando el día toca gimnasio, así que una sesión se describe una sola
 * vez y aparece igual en la app y en el email.
 *
 * Los bloques son superseries: cada uno agrupa dos ejercicios que se alternan.
 * Las prescripciones se han copiado literalmente para que las reconozcas.
 */

export type GymKey = 'pull-a' | 'push-a' | 'pull-b' | 'push-b';

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
  'En esta fase: top set + una serie de trabajo en los básicos, y nada de fallo en tren inferior. Los kilómetros los pone la carrera.';

export const GYM_SESSIONS: Record<GymKey, GymSession> = {
  'push-a': {
    key: 'push-a',
    label: 'Push A',
    blocks: [
      {
        name: 'Hack goma',
        prescription: '1×6-8 TS + 2×8-10',
        rest: '3:00',
        paired: 'Flexión de muñeca',
        pairedPrescription: '3 series',
      },
      {
        name: 'Press mancuernas inclinado, bajando bien',
        prescription: '1×5-7 TS + 2×9-10',
        rest: '3:00',
        paired: 'Gemelo multi, rango completo con rebote',
        pairedPrescription: '3×10-12 · 2:15',
      },
      {
        name: 'Extensiones de cuádriceps',
        prescription: '3×10-12',
        paired: 'Contractora pecho',
        pairedPrescription: '2×8-10',
      },
      {
        name: 'Extensiones tríceps polea estrecha con muñequeras',
        prescription: '2×10-12',
        rest: '2:00',
        paired: 'Elevaciones laterales en polea, muñequeras',
        pairedPrescription: '2×10-12',
      },
    ],
  },

  'pull-a': {
    key: 'pull-a',
    label: 'Pull A',
    blocks: [
      {
        name: 'Dominadas neutras con lastre',
        prescription: '1×3-5 TS + 3×8-10',
        rest: '3:00',
        paired: 'Isquio sentado',
        pairedPrescription: '3×10-12 · 2:15',
      },
      {
        name: 'Remo gironda neutro unilateral, pecho apoyado',
        prescription: '1×6-8 TS + 2×10-12',
        rest: '3:00',
        paired: 'Sóleo ROM completo, excéntrica 2 s',
        pairedPrescription: '3×10-12 · 2:00',
      },
      {
        name: 'Curl de bíceps en banco inclinado',
        prescription: '2×10-12',
        rest: '2:00',
        paired: 'Elevaciones laterales máquina',
        pairedPrescription: '1×5-7 + 2×10-12',
      },
      {
        name: 'Planchas',
        prescription: '3×10-15',
        rest: '2:00',
        paired: 'Encogimiento de hombros + abducción sentado',
        pairedPrescription: '2×12-15 + 2×10-12',
      },
    ],
  },

  'push-b': {
    key: 'push-b',
    label: 'Push B',
    blocks: [
      {
        name: 'Prensa plana',
        prescription: '1×6-8 TS + 2×10-12',
        rest: '3:00',
        paired: 'Aducción sentado',
        pairedPrescription: '2×10-12',
      },
      {
        name: 'Press banca',
        prescription: '1×3-5 TS + 2×6-8',
        rest: '3:00',
        paired: 'Gemelo multi, rango parcial, excéntrica 2 s',
        pairedPrescription: '3×10-12 · 2:15',
      },
      {
        name: 'Press militar máquina',
        prescription: '3×12-15',
        paired: 'Antebrazo, flexión en polea',
        pairedPrescription: '3×12-15',
      },
      {
        name: 'Sentadilla libre',
        prescription: '1×4-5 TS + 2×7-8',
        paired: 'Extensiones katana unilateral + extensiones lumbar',
        pairedPrescription: '2×10-12 + 2×12-15 · 2:00',
      },
    ],
  },

  'pull-b': {
    key: 'pull-b',
    label: 'Pull B',
    blocks: [
      {
        name: 'Hip thrust',
        prescription: '1×6-8 TS + 2×8-10',
        rest: '3:00',
        paired: 'Sóleo ROM parcial con rebote',
        pairedPrescription: '3×12-15 · 2:00',
      },
      {
        name: 'Jalón prono',
        prescription: '1×6-8 + 2×10-12',
        rest: '2:00',
        paired: 'Peck fly invertido',
        pairedPrescription: '3×8-10',
      },
      {
        name: 'Peso muerto rumano con mancuernas, bilateral',
        prescription: '3×12-15',
        rest: '2:00',
        paired: 'Curl de bíceps de pie con barra, apoyado en la pared',
        pairedPrescription: '2×8-10',
      },
      {
        name: 'Deltoides lateral con mancuernas',
        prescription: '1×8-10 + 2×12-15',
        rest: '2:00',
        paired: 'Abs en polea, crunch + oblicuo',
        pairedPrescription: '3×10-12 / 2×10-12',
      },
    ],
  },
};
