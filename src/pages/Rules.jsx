export default function Rules() {
  const rulesGrupos = [
    {
      title: 'Marcador exacto',
      desc: 'Si aciertas el resultado exacto (ej. pronóstico 2-1 y real 2-1).',
      points: 1,
    },
    {
      title: 'Ganador o empate',
      desc: 'Si aciertas quién gana o si hay empate.',
      points: 1,
    },
    {
      title: 'Goles del local',
      desc: 'Si aciertas la cantidad de goles del equipo local.',
      points: 1,
    },
    {
      title: 'Goles del visitante',
      desc: 'Si aciertas la cantidad de goles del equipo visitante.',
      points: 1,
    },
    {
      title: 'Diferencia de goles',
      desc: 'Si aciertas la diferencia de goles, pero solo cuenta si también acertaste el ganador o empate.',
      points: 1,
    },
  ]

  const bonusEliminatoria = [
    { error: 'Error 0', val: '+1.00' },
    { error: 'Error 1', val: '+0.75' },
    { error: 'Error 2', val: '+0.50' },
    { error: 'Error 3', val: '+0.25' },
    { error: 'Error 4+', val: '+0.00' },
  ]

  return (
    <div>
      <h2 className="page-title">📋 Reglas de puntuación</h2>
      <p className="page-subtitle">
        El sistema de puntos cambia entre fase de grupos y fase eliminatoria
      </p>

      {/* ───────────── FASE DE GRUPOS ───────────── */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ color: 'var(--gold)', marginBottom: '0.5rem' }}>
          📅 Fase de grupos <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 400 }}>(cerrada)</span>
        </h3>
        <p className="page-subtitle" style={{ marginBottom: '0.75rem' }}>Máximo 5 puntos por partido</p>

        <ul className="rules-list">
          {rulesGrupos.map((rule, i) => (
            <li key={i}>
              <span className="rule-num">{i + 1}</span>
              <div>
                <strong>{rule.title}</strong> — +{rule.points} pt
                <br />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{rule.desc}</span>
              </div>
            </li>
          ))}
        </ul>

        <div className="card" style={{ marginTop: '1rem', background: 'var(--bg-subtle, transparent)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            <strong style={{ color: 'var(--text)' }}>Ejemplo:</strong> Pronóstico 2-1 · Resultado real 3-2
            <br />
            Puntos: ganador (+1) + diferencia (+1) = <strong style={{ color: 'var(--gold)' }}>2 puntos</strong>
          </p>
        </div>
      </div>

      {/* ───────────── FASE ELIMINATORIA ───────────── */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ color: 'var(--gold)', marginBottom: '0.5rem' }}>
          🏆 Dieciseisavos en adelante <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 400 }}>(nuevo)</span>
        </h3>
        <p className="page-subtitle" style={{ marginBottom: '0.75rem' }}>Máximo 6.00 puntos por partido</p>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
          Pronosticas el marcador con el que crees que <strong style={{ color: 'var(--text)' }}>termina el partido</strong>,
          considerando que puede llegar a tiempo extra (120'). Los penales nunca se pronostican ni afectan los puntos.
        </p>

        <ul className="rules-list">
          <li>
            <span className="rule-num">1</span>
            <div>
              <strong>¿Acertaste quién gana?</strong>
              <br />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Si NO acertaste el ganador: ganas 1 punto si tu marcador de local o visitante fue exacto, o 0 si no acertaste ninguno.
                Si SÍ acertaste el ganador, sigue a los puntos 2 y 3.
              </span>
            </div>
          </li>
          <li>
            <span className="rule-num">2</span>
            <div>
              <strong>Puntaje base</strong> (solo si acertaste el ganador)
              <br />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Marcador exacto (ambos equipos) → <strong>5.00</strong>. Acertaste el marcador de un solo equipo → <strong>3.00</strong>. No acertaste ningún marcador exacto → <strong>2.00</strong>.
              </span>
            </div>
          </li>
          <li>
            <span className="rule-num">3</span>
            <div>
              <strong>Bono por cercanía</strong> (solo si acertaste el ganador)
              <br />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Se suma según qué tan cerca quedó tu pronóstico del resultado real.
              </span>
            </div>
          </li>
        </ul>

        <div className="bonus-box" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
          {bonusEliminatoria.map((b) => (
            <div key={b.error} className="card" style={{ padding: '0.5rem 0.9rem', textAlign: 'center', minWidth: '80px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.error}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--gold)' }}>{b.val}</div>
            </div>
          ))}
        </div>

        <div className="card" style={{ marginTop: '1rem', background: 'var(--bg-subtle, transparent)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            <strong style={{ color: 'var(--text)' }}>Ejemplo:</strong> Pronóstico 2-1 · Resultado real 3-1
            <br />
            Acertaste el ganador y el marcador del visitante (1) → base 3.00. Error total de goles = 1 → bono +0.75
            <br />
            Total: <strong style={{ color: 'var(--gold)' }}>3.75 puntos</strong>
          </p>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <h3 style={{ color: 'var(--gold)', marginBottom: '0.75rem' }}>Otras reglas</h3>
        <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-muted)', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <li>
            <strong style={{ color: 'var(--text)' }}>Fase de grupos:</strong> el pronóstico se bloquea cuando el partido inicia (hora Colombia).
          </li>
          <li>
            <strong style={{ color: 'var(--text)' }}>Dieciseisavos en adelante:</strong> el pronóstico se bloquea <strong style={{ color: 'var(--text)' }}>una hora antes</strong> del inicio del partido (hora Colombia).
          </li>
          <li>Puedes pronosticar todos los partidos por adelantado; el límite es solo de edición, no de cuándo puedes llenarlos.</li>
          <li>Solo el administrador puede registrar los resultados reales.</li>
          <li>Los puntos se calculan automáticamente al cerrar cada partido.</li>
        </ul>
      </div>
    </div>
  )
}
