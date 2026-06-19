export default function Rules() {
  const rules = [
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

  return (
    <div>
      <h2 className="page-title">📋 Reglas de puntuación</h2>
      <p className="page-subtitle">Máximo 5 puntos por partido</p>

      <ul className="rules-list">
        {rules.map((rule, i) => (
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

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h3 style={{ color: 'var(--gold)', marginBottom: '0.75rem' }}>Otras reglas</h3>
        <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-muted)', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <li>Solo puedes editar pronósticos de partidos que <strong style={{ color: 'var(--text)' }}>aún no han empezado</strong> (hora Colombia).</li>
          <li>Cuando un partido inicia, tu pronóstico queda bloqueado.</li>
          <li>Solo el administrador puede registrar los resultados reales.</li>
          <li>Los puntos se calculan automáticamente al cerrar cada partido.</li>
        </ul>
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <h3 style={{ color: 'var(--gold)', marginBottom: '0.75rem' }}>Ejemplo</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Pronóstico: <strong style={{ color: 'var(--text)' }}>2-1</strong> · Resultado real: <strong style={{ color: 'var(--text)' }}>3-2</strong>
          <br />
          Puntos: ganador (+1) + diferencia (+1) = <strong style={{ color: 'var(--gold)' }}>2 puntos</strong>
        </p>
      </div>
    </div>
  )
}
