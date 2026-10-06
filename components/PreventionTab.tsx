/** Contenido estático de la pestaña de prevención. */

export function PreventionTab() {
  return (
    <>
      <div className="card">
        <h3>🚦 Semáforo de dolor</h3>
        <div className="muted" style={{ marginBottom: 10 }}>
          Evalúa el dolor tibial <b>al terminar</b>, <b>2 h después</b> y{' '}
          <b>al día siguiente</b>.
        </div>

        <div className="acc" style={{ borderColor: '#22c55e' }}>
          <b>🟢 Verde · 0-2 / 10</b>
          <span className="muted">
            Molestia difusa que desaparece al calentar y no deja secuelas. → Entrena normal.
          </span>
        </div>
        <div className="acc" style={{ borderColor: '#eab308' }}>
          <b>🟡 Amarillo · 3-4 / 10</b>
          <span className="muted">
            Aparece a mitad de sesión y no persiste al día siguiente. →{' '}
            <b>Reduce el volumen un 30 %.</b> Sin intervalos. Revisa en 48 h.
          </span>
        </div>
        <div className="acc" style={{ borderColor: '#f97316' }}>
          <b>🟠 Naranja · 5-6 / 10</b>
          <span className="muted">
            Dolor difuso (zona &gt; 5 cm) que persiste al día siguiente o al caminar. →{' '}
            <b>Para la carrera.</b> Sustituye por bici. 5-7 días mínimo.
          </span>
        </div>
        <div className="acc" style={{ borderColor: '#ef4444' }}>
          <b>🔴 Rojo · &gt;6 / 10 o dolor focal</b>
          <span className="muted">
            Dolor puntual (&lt; 2 cm), nocturno, al levantarte, o cojera. →{' '}
            <b>PARA y consulta a un médico del deporte.</b>
          </span>
        </div>
      </div>

      <div className="card">
        <h3>⚠️ Las 4 señales que separan molestia de lesión</h3>
        <ul className="clean">
          <li>
            <b>Dolor focal</b> — puedes señalarlo con un dedo, no es difuso.
          </li>
          <li>
            <b>No calienta</b> con el movimiento, o empeora mientras corres.
          </li>
          <li>
            <b>Dolor en reposo</b> o por la noche.
          </li>
          <li>
            <b>Empeora al día siguiente</b> de forma repetida.
          </li>
        </ul>
        <div className="note warn" style={{ margin: '12px 0 0' }}>
          Cualquiera de estas cuatro = nivel naranja o rojo. No lo negocies contigo mismo.
        </div>
      </div>

      <div className="card">
        <h3>📈 Reglas de carga</h3>
        <div className="acc">
          <b>ACWR = km de esta semana ÷ media de las 4 anteriores</b>
          <span className="muted">
            0,8 – 1,3 ✅ zona segura · 1,3 – 1,5 ⚠️ riesgo · &gt; 1,5 🔴 lesión
          </span>
        </div>
        <ul className="clean">
          <li>
            <b>+8 % máximo</b> de volumen semanal.
          </li>
          <li>
            <b>Descarga cada 3-4 semanas</b> (−25-30 %).
          </li>
          <li>
            La <b>tirada larga</b> nunca crece más de 1,5 km.
          </li>
          <li>
            <b>Nunca</b> subir volumen + intensidad la misma semana.
          </li>
          <li>
            Tras una semana perdida, vuelve al volumen de <b>2 semanas atrás</b>.
          </li>
        </ul>
      </div>

      <div className="card">
        <h3>🦵 Rutina tibial / sóleo</h3>
        <div className="muted" style={{ marginBottom: 8 }}>
          8-10 min · 3-4×/semana · <b>nunca justo antes de correr</b>.
        </div>
        <table>
          <thead>
            <tr>
              <th>Ejercicio</th>
              <th>Dosis</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1 · Isométrico de sóleo en pared</td>
              <td>3×45 s</td>
            </tr>
            <tr>
              <td>2 · Elevación de talón excéntrica, rodilla flexionada</td>
              <td>3×12 / pierna</td>
            </tr>
            <tr>
              <td>3 · Inversión con banda (tibial posterior)</td>
              <td>3×15 / pierna</td>
            </tr>
            <tr>
              <td>4 · Elevación de puntas con banda (tibial anterior)</td>
              <td>3×15</td>
            </tr>
            <tr>
              <td>5 · Dorsiflexión de tobillo contra la pared</td>
              <td>3×30 s / pierna</td>
            </tr>
            <tr>
              <td>6 · Autoliberación plantar con pelota</td>
              <td>60 s / pie</td>
            </tr>
            <tr>
              <td>7 · Pogo hops (desde S9)</td>
              <td>3×20 s</td>
            </tr>
          </tbody>
        </table>
        <div className="note" style={{ margin: '12px 0 0' }}>
          <b>Progresión:</b> S1-S4 → 1, 3, 5, 6 · S5-S8 → +2, +4 · S9+ → +7
        </div>
      </div>

      <div className="card">
        <h3>👟 Cadencia · superficie · calzado</h3>
        <ul className="clean">
          <li>
            <b>Cadencia 172-178 ppm</b> en rodajes fáciles. Cuenta 30 s y multiplica por 2.
          </li>
          <li>
            Sube <b>+3-5 ppm cada 2 semanas</b>. Drill: 4×30 s a cadencia exagerada.
          </li>
          <li>
            <b>Preferir:</b> cinta, tierra/grava compactada, asfalto liso. <b>Evitar:</b> hormigón,
            adoquín, trail irregular.
          </li>
          <li>
            <b>Sin series cuesta abajo</b> durante las primeras 16 semanas.
          </li>
          <li>
            <b>2 pares de zapatillas en rotación</b>, altérnalos cada sesión.
          </li>
          <li>
            <b>Nada de placa de carbono</b> hasta S17. Recambio a los 600-700 km.
          </li>
        </ul>
      </div>

      <div className="card">
        <h3>🍽️ Nutrición y sueño para el hueso</h3>
        <table>
          <thead>
            <tr>
              <th>Factor</th>
              <th>Dosis</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Calcio</td>
              <td>1.000-1.200 mg/día (dieta)</td>
            </tr>
            <tr>
              <td>Vitamina D</td>
              <td>1.000-2.000 UI/día (oct-mar)</td>
            </tr>
            <tr>
              <td>Colágeno + vit C</td>
              <td>15 g + 40 mg, 45-60 min pre-carga</td>
            </tr>
            <tr>
              <td>Proteína</td>
              <td>1,6-1,8 g/kg → 125-140 g/día</td>
            </tr>
            <tr>
              <td>Energía</td>
              <td>Sin déficit agresivo</td>
            </tr>
            <tr>
              <td>Sueño</td>
              <td>7-9 h (objetivo 8)</td>
            </tr>
          </tbody>
        </table>
        <div className="note" style={{ margin: '12px 0 0' }}>
          El déficit energético es el <b>factor nº 1</b> de lesión ósea. Si quieres bajar grasa,
          despacio y solo en fases 1-2.
        </div>
      </div>

      <div className="card">
        <h3>🚑 Cuándo consultar a un médico</h3>
        <ul className="clean">
          <li>
            Dolor que puedes señalar <b>con un dedo</b> en el borde de la tibia.
          </li>
          <li>
            Dolor que <b>no desaparece en reposo</b>.
          </li>
          <li>
            Dolor <b>nocturno</b> que te despierta.
          </li>
          <li>
            <b>Cojera</b> o dolor al subir escaleras.
          </li>
          <li>
            Zona dolorosa de <b>menos de 2 cm</b>.
          </li>
        </ul>
        <div className="note warn" style={{ margin: '12px 0 0' }}>
          Entre periostitis y fractura por estrés hay un espectro continuo. Reconocerla a tiempo
          cuesta una semana; ignorarla cuesta media temporada.
        </div>
      </div>

      <div className="card">
        <h3>🔁 Cross-training como descarga</h3>
        <div className="muted" style={{ marginBottom: 6 }}>
          Si la tibia está sensible, <b>no paras: cambias de medio</b>.
        </div>
        <table>
          <thead>
            <tr>
              <th>Sustitución</th>
              <th>Equivalencia</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1 km corriendo</td>
              <td>≈ 3-4 min de bici</td>
            </tr>
            <tr>
              <td>1 km corriendo</td>
              <td>≈ 4-5 min de cinta inclinada</td>
            </tr>
            <tr>
              <td>30 min bici Z2</td>
              <td>≈ 8-9 km de rodaje</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
