/**
 * Protocolo de prevención.
 *
 * Sin iconos ni emoji: la jerarquía la construyen las cifras, las reglas finas
 * y las versalitas monoespaciadas.
 */

export function PreventionTab() {
  return (
    <>
      <div className="sect">
        <p className="eyebrow">Semáforo de dolor</p>
        <p className="dim" style={{ fontSize: 13, margin: '10px 0 18px', maxWidth: '40ch' }}>
          Puntúa la tibia tres veces: al terminar, dos horas después y a la mañana siguiente.
        </p>

        <div className="ladder">
          <div className="step" data-lvl="0">
            <span className="step-n">00</span>
            <span>
              <span className="step-t">Verde · 0-2</span>
              <span className="step-d">
                Molestia difusa que se va al calentar y no deja secuela. Entrena normal.
              </span>
            </span>
          </div>
          <div className="step" data-lvl="1">
            <span className="step-n">01</span>
            <span>
              <span className="step-t">Ámbar · 3-4</span>
              <span className="step-d">
                Aparece a media sesión y no persiste al día siguiente. Recorta el volumen un 30 %,
                fuera intervalos, y revisa en 48 h.
              </span>
            </span>
          </div>
          <div className="step" data-lvl="2">
            <span className="step-n">02</span>
            <span>
              <span className="step-t">Naranja · 5-6</span>
              <span className="step-d">
                Dolor difuso —más de 5 cm— que sigue al día siguiente o al caminar. Para la
                carrera, pasa a la bici, mínimo 5-7 días.
              </span>
            </span>
          </div>
          <div className="step" data-lvl="3">
            <span className="step-n">03</span>
            <span>
              <span className="step-t">Rojo · más de 6, o focal</span>
              <span className="step-d">
                Dolor puntual de menos de 2 cm, nocturno, al levantarte, o cojera. Para y consulta a
                un médico del deporte.
              </span>
            </span>
          </div>
        </div>
      </div>

      <div className="sect">
        <p className="eyebrow">Las cuatro señales</p>
        <p className="dim" style={{ fontSize: 13, margin: '10px 0 6px', maxWidth: '40ch' }}>
          Separan la molestia de la lesión.
        </p>
        <ul className="bullets">
          <li>
            <b>Focal.</b> La puedes señalar con un dedo, no es difusa.
          </li>
          <li>
            <b>No calienta.</b> No mejora con el movimiento, o empeora mientras corres.
          </li>
          <li>
            <b>En reposo.</b> Duele sin correr, o por la noche.
          </li>
          <li>
            <b>Al día siguiente.</b> Empeora de forma repetida.
          </li>
        </ul>
        <p className="pull alert">
          Cualquiera de las cuatro te pone en naranja o rojo. No lo negocies contigo mismo.
        </p>
      </div>

      <div className="sect">
        <p className="eyebrow">Reglas de carga</p>
        <table className="kv" style={{ marginTop: 14 }}>
          <tbody>
            <tr>
              <td>
                <b>Cociente agudo/crónico</b>
                <br />
                <span className="soft">km de esta semana ÷ media de las 4 anteriores</span>
              </td>
              <td>0,8 – 1,3</td>
            </tr>
            <tr>
              <td>Subida máxima semanal</td>
              <td>+8 %</td>
            </tr>
            <tr>
              <td>Descarga</td>
              <td>cada 3-4 sem.</td>
            </tr>
            <tr>
              <td>Crecimiento del fondo</td>
              <td>≤ 1,5 km</td>
            </tr>
          </tbody>
        </table>
        <ul className="bullets" style={{ marginTop: 4 }}>
          <li>Nunca subas volumen e intensidad la misma semana.</li>
          <li>Tras una semana perdida, vuelve al volumen de dos semanas atrás.</li>
        </ul>
      </div>

      <div className="sect">
        <p className="eyebrow">Rutina tibial y de sóleo</p>
        <p className="dim" style={{ fontSize: 13, margin: '10px 0 6px' }}>
          8-10 minutos, 3-4 veces por semana. Nunca justo antes de correr.
        </p>
        <table className="kv" style={{ marginTop: 10 }}>
          <tbody>
            <tr>
              <td>01 · Isométrico de sóleo en pared</td>
              <td>3 × 45 s</td>
            </tr>
            <tr>
              <td>02 · Elevación de talón excéntrica, rodilla flexionada</td>
              <td>3 × 12</td>
            </tr>
            <tr>
              <td>03 · Inversión con banda · tibial posterior</td>
              <td>3 × 15</td>
            </tr>
            <tr>
              <td>04 · Puntas de pie con banda · tibial anterior</td>
              <td>3 × 15</td>
            </tr>
            <tr>
              <td>05 · Dorsiflexión de tobillo contra la pared</td>
              <td>3 × 30 s</td>
            </tr>
            <tr>
              <td>06 · Autoliberación plantar con pelota</td>
              <td>60 s / pie</td>
            </tr>
            <tr>
              <td>07 · Pogo hops · desde la semana 9</td>
              <td>3 × 20 s</td>
            </tr>
          </tbody>
        </table>
        <p className="pull">
          Progresión — S1 a S4: 01, 03, 05, 06 · S5 a S8: añade 02 y 04 · S9 en adelante: añade 07.
        </p>
      </div>

      <div className="sect">
        <p className="eyebrow">Zancada, suelo, calzado</p>
        <ul className="bullets" style={{ marginTop: 6 }}>
          <li>
            <b>Cadencia 172-178 ppm</b> en rodajes fáciles. Cuenta 30 s y multiplica por dos.
          </li>
          <li>Sube 3-5 ppm cada dos semanas. Trabájalo con series de 30 s a cadencia exagerada.</li>
          <li>
            <b>Mejor suelo:</b> cinta, tierra o grava compacta, asfalto liso. <b>Evita</b> hormigón,
            adoquín y trail irregular.
          </li>
          <li>Nada de series cuesta abajo durante las primeras 16 semanas.</li>
          <li>Dos pares de zapatillas en rotación, alternados cada sesión.</li>
          <li>Placa de carbono, solo a partir de la semana 17. Recambio a los 600-700 km.</li>
        </ul>
      </div>

      <div className="sect">
        <p className="eyebrow">Hueso: lo que comes y lo que duermes</p>
        <table className="kv" style={{ marginTop: 14 }}>
          <tbody>
            <tr>
              <td>Calcio</td>
              <td>1.000-1.200 mg</td>
            </tr>
            <tr>
              <td>Vitamina D · de octubre a marzo</td>
              <td>1.000-2.000 UI</td>
            </tr>
            <tr>
              <td>Colágeno + vitamina C · 45-60 min antes</td>
              <td>15 g + 40 mg</td>
            </tr>
            <tr>
              <td>Proteína</td>
              <td>1,6-1,8 g/kg</td>
            </tr>
            <tr>
              <td>Sueño</td>
              <td>7-9 h</td>
            </tr>
          </tbody>
        </table>
        <p className="pull">
          El déficit energético es el primer factor de lesión ósea. Si quieres bajar grasa, que sea
          despacio y solo en las fases 1 y 2.
        </p>
      </div>

      <div className="sect">
        <p className="eyebrow">Cuándo llamar al médico</p>
        <ul className="bullets" style={{ marginTop: 6 }}>
          <li>Dolor que señalas con un dedo en el borde de la tibia.</li>
          <li>Dolor que no cede en reposo.</li>
          <li>Dolor nocturno que te despierta.</li>
          <li>Cojera, o dolor al subir escaleras.</li>
          <li>Zona dolorosa de menos de 2 cm.</li>
        </ul>
        <p className="pull alert">
          Entre periostitis y fractura por estrés hay un espectro continuo. Reconocerla a tiempo
          cuesta una semana; ignorarla cuesta media temporada.
        </p>
      </div>

      <div className="sect">
        <p className="eyebrow">Cambiar de medio</p>
        <p className="dim" style={{ fontSize: 13, margin: '10px 0 6px' }}>
          Con la tibia sensible no paras: cambias de disciplina.
        </p>
        <table className="kv" style={{ marginTop: 10 }}>
          <tbody>
            <tr>
              <td>1 km corriendo</td>
              <td>≈ 3-4 min bici</td>
            </tr>
            <tr>
              <td>1 km corriendo</td>
              <td>≈ 4-5 min cinta</td>
            </tr>
            <tr>
              <td>30 min de bici en Z2</td>
              <td>≈ 8-9 km</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
