import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'


// ───── Configuración del bote ─────
// 15 jugadores × $20.000 cada uno = $300.000
const TOTAL_JUGADORES = 15
const APUESTA_POR_JUGADOR = 20000
const BOTE_TOTAL = TOTAL_JUGADORES * APUESTA_POR_JUGADOR
const PORCENTAJES_PREMIO = [0.5, 0.3, 0.2] // 1°, 2°, 3°

// ───── Marquesina con el ranking de jugadores ─────
// Ticker horizontal que se desplaza en loop infinito mostrando
// puesto, nombre y puntos de cada jugador. Se duplica la lista
// una vez para que el scroll sea continuo (sin salto visible).
function MarqueeRanking({ data }) {
  if (!data || data.length === 0) return null

  const items = [...data, ...data] // duplicado para loop continuo

  return (
    <div
      className="marquee-ranking"
      style={{
        overflow: 'hidden',
        borderRadius: '0.6rem',
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.03)',
        marginBottom: '1.25rem',
        position: 'relative',
      }}
    >
      <style>{`
        @keyframes marquee-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .marquee-ranking:hover .marquee-track {
          animation-play-state: paused;
        }
      `}</style>

      <div
        className="marquee-track"
        style={{
          display: 'flex',
          width: 'max-content',
          animation: `marquee-scroll ${Math.max(items.length * 2.2, 12)}s linear infinite`,
        }}
      >
        {items.map((player, i) => (
          <div
            key={`${player.id ?? player.display_name}-${i}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.6rem 1.25rem',
              whiteSpace: 'nowrap',
              borderRight: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <span
              style={{
                fontSize: player.puesto <= 3 ? '1rem' : '0.8rem',
                color: player.puesto <= 3 ? undefined : 'var(--text-muted)',
              }}
            >
              {medalForRank(player.puesto)}
            </span>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              {player.display_name}
            </span>
            <span
              style={{
                fontSize: '0.8rem',
                color: 'var(--gold)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {player.total} pts
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Premio en pesos para un puesto dado (top 3), o null si no aplica.
function calcularPremio(puesto) {
  const pct = PORCENTAJES_PREMIO[puesto - 1]
  if (!pct) return null
  return BOTE_TOTAL * pct
}

function medalForRank(rank) {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return rank
}

function formatCOP(valor) {
  return valor.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

// Calcula posiciones reales respetando empates.
// Ejemplo:
// 133
// 133
// 133
// 131
// 130
//
// Resultado:
// 1
// 1
// 1
// 4
// 5
function calcularPosiciones(standings) {
  let puestoActual = 1

  return standings.map((player, index) => {
    if (
      index > 0 &&
      Number(player.total) !== Number(standings[index - 1].total)
    ) {
      puestoActual = index + 1
    }

    return {
      ...player,
      puesto: puestoActual,
    }
  })
}

// Supabase/PostgREST limita cada consulta a 1000 filas por defecto.
// Con 15 jugadores x hasta 104 partidos, "predictions" puede superar
// ese límite fácilmente, así que paginamos con .range() hasta traer
// TODAS las filas antes de calcular cualquier estadística.
const SUPABASE_PAGE_SIZE = 1000

async function fetchAllRows(table, columns) {
  let allRows = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + SUPABASE_PAGE_SIZE - 1)

    if (error) throw error

    allRows = allRows.concat(data || [])

    if (!data || data.length < SUPABASE_PAGE_SIZE) break
    from += SUPABASE_PAGE_SIZE
  }

  return allRows
}

// Orden cronológico de fases del torneo, para mostrar/ordenar consistentemente
const ORDEN_FASES = [
  'Fase de grupos',
  'Dieciseisavos de final',
  'Octavos de final',
  'Cuartos de final',
  'Semifinal',
  'Final',
]

function ordenarFases(fases) {
  return [...fases].sort((a, b) => {
    const ia = ORDEN_FASES.indexOf(a)
    const ib = ORDEN_FASES.indexOf(b)
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
  })
}

// Cruza predictions + matches + profiles manualmente (sin depender de
// relaciones anidadas de Supabase, que pueden fallar silenciosamente
// si hay ambigüedad de foreign keys) y agrupa estadísticas por jugador,
// tanto globales como por fase.
function calcularEstadisticas(predictions, matches, profiles) {
  const matchById = new Map(matches.map((m) => [m.id, m]))
  const profileById = new Map(profiles.map((p) => [p.id, p]))
  const porJugador = {}

  predictions.forEach((pred) => {
    const partido = matchById.get(pred.match_id)
    const perfil = profileById.get(pred.user_id)
    if (!partido || !perfil || !partido.is_finished) return
    if (pred.home_score == null || pred.away_score == null) return
    if (partido.home_score == null || partido.away_score == null) return

    const nombre = perfil.display_name
    if (!porJugador[nombre]) {
      porJugador[nombre] = {
        display_name: nombre,
        jugados: 0,
        exactos: 0,
        ganador: 0,
        porFase: {},
      }
    }

    const jugador = porJugador[nombre]
    const esExacto =
      pred.home_score === partido.home_score &&
      pred.away_score === partido.away_score
    const esGanador =
      Math.sign(pred.home_score - pred.away_score) ===
      Math.sign(partido.home_score - partido.away_score)

    jugador.jugados += 1
    if (esExacto) jugador.exactos += 1
    if (esGanador) jugador.ganador += 1

    const fase = partido.stage || 'Sin fase'
    if (!jugador.porFase[fase]) {
      jugador.porFase[fase] = { jugados: 0, exactos: 0, ganador: 0 }
    }
    jugador.porFase[fase].jugados += 1
    if (esExacto) jugador.porFase[fase].exactos += 1
    if (esGanador) jugador.porFase[fase].ganador += 1
  })

  return Object.values(porJugador).map((j) => ({
    ...j,
    pct_exactos: j.jugados ? Math.round((j.exactos / j.jugados) * 1000) / 10 : 0,
    pct_ganador: j.jugados ? Math.round((j.ganador / j.jugados) * 1000) / 10 : 0,
  }))
}

export default function Ranking() {
  const [standings, setStandings] = useState([])
  const [loading, setLoading] = useState(true)
  // 'ranking' = tabla única de posiciones (todos pagan, todos compiten por el bote)
  // 'analisis' = gráficos de aciertos
  const [vista, setVista] = useState('ranking')

  const [statsJugadores, setStatsJugadores] = useState([])
  const [loadingAnalisis, setLoadingAnalisis] = useState(false)
  const [analisisCargado, setAnalisisCargado] = useState(false)


  const [proyeccion, setProyeccion] = useState([])
  const [loadingProyeccion, setLoadingProyeccion] = useState(false)
  const [proyeccionCargada, setProyeccionCargada] = useState(false)


  // Puesto real de cada jugador. "standings" ya viene ordenado por
  // total desc desde Supabase.
  const rankingConPuestos = calcularPosiciones(standings)

  useEffect(() => {
    loadRanking()
  }, [])

  useEffect(() => {
    if (vista === 'analisis' && !analisisCargado) {
      loadAnalisis()
    }
  }, [vista])


  useEffect(() => {
    if (vista === 'proyeccion' && !proyeccionCargada) {
      loadProyeccion()
    }
  }, [vista])




  async function loadAnalisis() {
    try {
      setLoadingAnalisis(true)

      const [predsData, matchesData, profilesData] = await Promise.all([
        fetchAllRows('predictions', 'user_id, match_id, home_score, away_score'),
        fetchAllRows('matches', 'id, stage, home_score, away_score, is_finished'),
        fetchAllRows('profiles', 'id, display_name'),
      ])

      setStatsJugadores(
        calcularEstadisticas(predsData, matchesData, profilesData)
      )
      setAnalisisCargado(true)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingAnalisis(false)
    }
  }

  async function loadProyeccion() {
    try {
      setLoadingProyeccion(true)

      const { data, error } = await supabase
        .from('analizar_proyeccion_campeonato')
        .select('*')

      if (error) {
        console.error(error)
        return
      }

      setProyeccion(data || [])
      setProyeccionCargada(true)

    } catch (err) {
      console.error(err)
    } finally {
      setLoadingProyeccion(false)
    }
  }



  async function loadRanking() {
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('ranking_view')
        .select('*')
        .order('total', { ascending: false })

      if (error) {
        console.error(error)
        return
      }

      setStandings(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  function exportPDF() {
    const doc = new jsPDF()

    doc.setFontSize(22)
    doc.text('Ranking Mundial FIFA 2026', 14, 20)

    doc.setFontSize(11)
    doc.text(
      `Generado: ${new Date().toLocaleString('es-CO')}`,
      14,
      28
    )
    doc.text(
      `Bote total: ${formatCOP(BOTE_TOTAL)} (${TOTAL_JUGADORES} jugadores x ${formatCOP(APUESTA_POR_JUGADOR)})`,
      14,
      35
    )

    autoTable(doc, {
      startY: 45,
      head: [['Posición', 'Participante', 'Puntos', 'Premio']],
      body: rankingConPuestos.map((player) => {
        const premio = calcularPremio(player.puesto)
        return [
          player.puesto,
          player.display_name,
          player.total,
          premio != null ? formatCOP(premio) : '—',
        ]
      }),
      styles: {
        fontSize: 10,
      },
      headStyles: {
        fillColor: [18, 34, 64],
      },
    })

    doc.save('ranking-fifa-2026.pdf')
  }

  if (loading) {
    return (
      <div
        className="loading-screen"
        style={{ minHeight: '200px' }}
      >
        <div className="loader" />
      </div>
    )
  }

  return (
    <div>
      <h2 className="page-title">🏆 Ranking</h2>

      <p className="page-subtitle">
        Clasificación general de la polla · Bote total:{' '}
        {formatCOP(BOTE_TOTAL)} ({TOTAL_JUGADORES} jugadores ×{' '}
        {formatCOP(APUESTA_POR_JUGADOR)})
      </p>

      {/* ───── Marquesina con el ranking ───── */}
      <MarqueeRanking data={rankingConPuestos} />

      {/* ───── Selector de vista ───── */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '1rem',
        }}
      >
        <button
          className={vista === 'ranking' ? 'btn btn-gold' : 'btn'}
          onClick={() => setVista('ranking')}
        >
          🏆 Ranking {standings.length}
        </button>

        <button
          className={vista === 'analisis' ? 'btn btn-gold' : 'btn'}
          onClick={() => setVista('analisis')}
        >
          📈 Análisis
        </button>

        <button
          className={vista === 'proyeccion' ? 'btn btn-gold' : 'btn'}
          onClick={() => setVista('proyeccion')}
        >
          🚀 Proyección
        </button>


      </div>

      {vista === 'ranking' && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginBottom: '1rem',
          }}
        >
          <button
            className="btn btn-gold"
            onClick={exportPDF}
          >
            📄 Exportar PDF
          </button>
        </div>
      )}

      {vista !== 'ranking' && (
        <div
          className="card"
          style={{
            padding: 0,
            overflow: 'hidden',
          }}
        >
          <table className="ranking-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Participante</th>
                <th>Puntos</th>
                <th>Premio</th>
              </tr>
            </thead>

            <tbody>
              {rankingConPuestos.map((player) => {
                const premio = calcularPremio(player.puesto)
                return (
                  <tr key={player.id}>
                    <td className="rank-medal">
                      {medalForRank(player.puesto)}
                    </td>

                    <td>
                      {player.display_name}

                      {player.role === 'admin' && (
                        <span
                          style={{
                            marginLeft: '0.5rem',
                            fontSize: '0.75rem',
                            color: 'var(--gold)',
                          }}
                        >
                          (Admin)
                        </span>
                      )}
                    </td>

                    <td className="rank-points">
                      {player.total}
                    </td>

                    <td
                      className="rank-points"
                      style={{
                        color: premio != null ? 'var(--gold)' : 'var(--text-muted)',
                      }}
                    >
                      {premio != null ? formatCOP(premio) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {vista === 'analisis' && (
        <AnalisisDashboard
          loading={loadingAnalisis}
          stats={statsJugadores}
        />
      )}

      {vista === 'proyeccion' && (
        <ProyeccionDashboard
          loading={loadingProyeccion}
          data={proyeccion}
        />
      )}



    </div>
  )
}

// ───────────────────────────────────────────────
// Dashboard de análisis: KPIs, leaderboards e insights
// ───────────────────────────────────────────────

function AnalisisDashboard({ loading, stats }) {
  if (loading) {
    return (
      <div className="loading-screen" style={{ minHeight: '200px' }}>
        <div className="loader" />
      </div>
    )
  }

  if (stats.length === 0) {
    return (
      <p style={{ color: 'var(--text-muted)' }}>
        Aún no hay partidos finalizados para analizar.
      </p>
    )
  }

  const porExactos = [...stats].sort((a, b) => b.exactos - a.exactos)
  const porGanador = [...stats].sort((a, b) => b.ganador - a.ganador)
  const fases = ordenarFases(
    Array.from(new Set(stats.flatMap((j) => Object.keys(j.porFase))))
  )

  const liderExactos = porExactos[0]
  const liderGanador = porGanador[0]
  const promedioExactos =
    Math.round(
      (stats.reduce((sum, j) => sum + j.pct_exactos, 0) / stats.length) * 10
    ) / 10

  // Delta de rendimiento entre la primera y la última fase disponible
  // (positivo = mejora en fase eliminatoria, negativo = empeora)
  let mayorMejora = null
  let mayorCaida = null
  if (fases.length > 1) {
    const primera = fases[0]
    const ultima = fases[fases.length - 1]
    const deltas = stats
      .filter((j) => j.porFase[primera]?.jugados && j.porFase[ultima]?.jugados)
      .map((j) => {
        const pctPrimera = Math.round(
          (j.porFase[primera].exactos / j.porFase[primera].jugados) * 1000
        ) / 10
        const pctUltima = Math.round(
          (j.porFase[ultima].exactos / j.porFase[ultima].jugados) * 1000
        ) / 10
        return { display_name: j.display_name, delta: pctUltima - pctPrimera, pctPrimera, pctUltima }
      })
    if (deltas.length) {
      mayorMejora = [...deltas].sort((a, b) => b.delta - a.delta)[0]
      mayorCaida = [...deltas].sort((a, b) => a.delta - b.delta)[0]
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ───── Fila de KPIs ───── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
        }}
      >
        <KpiCard
          icono="🎯"
          etiqueta="Rey del marcador exacto"
          valor={liderExactos.display_name}
          detalle={`${liderExactos.exactos} de ${liderExactos.jugados} partidos (${liderExactos.pct_exactos}%)`}
        />
        <KpiCard
          icono="🧠"
          etiqueta="Mejor leyendo el ganador"
          valor={liderGanador.display_name}
          detalle={`${liderGanador.ganador} de ${liderGanador.jugados} partidos (${liderGanador.pct_ganador}%)`}
        />
        <KpiCard
          icono="📊"
          etiqueta="Promedio del grupo"
          valor={`${promedioExactos}%`}
          detalle="Acierto exacto promedio entre todos"
        />
        {mayorMejora && (
          <KpiCard
            icono={mayorMejora.delta >= 0 ? '📈' : '📉'}
            etiqueta={mayorMejora.delta >= 0 ? 'Sube en eliminación' : 'Mejor en fase de grupos'}
            valor={mayorMejora.display_name}
            detalle={`${mayorMejora.delta >= 0 ? '+' : ''}${mayorMejora.delta.toFixed(1)} pts vs. fase de grupos`}
          />
        )}
      </div>

      {/* ───── Leaderboard: marcador exacto ───── */}
      <Leaderboard
        titulo="🎯 Marcador exacto"
        subtitulo="Partidos donde acertaron el resultado tal cual"
        data={porExactos}
        campo="exactos"
        campoPct="pct_exactos"
      />

      {/* ───── Leaderboard: ganador ───── */}
      <Leaderboard
        titulo="✅ Acertó el ganador"
        subtitulo="Incluye los marcadores exactos, ya que acertar el marcador implica acertar el ganador"
        data={porGanador}
        campo="ganador"
        campoPct="pct_ganador"
        colorBarra="#4a90d9"
      />

      {/* ───── Comparación por fase ───── */}
      {fases.length > 1 && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ margin: 0 }}>📐 Fase de grupos vs. eliminación</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.25rem 0 1.25rem' }}>
            % de acierto exacto por jugador en cada fase
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: '1rem',
            }}
          >
            {[...stats]
              .sort((a, b) => b.pct_exactos - a.pct_exactos)
              .map((j) => (
                <FaseMiniCard key={j.display_name} jugador={j} fases={fases} />
              ))}
          </div>

          {mayorCaida && mayorMejora && mayorCaida.display_name !== mayorMejora.display_name && (
            <p
              style={{
                fontSize: '0.85rem',
                color: 'var(--text-muted)',
                marginTop: '1.25rem',
                paddingTop: '1rem',
                borderTop: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              💡 <strong style={{ color: 'var(--gold)' }}>{mayorMejora.display_name}</strong> mejoró{' '}
              {Math.abs(mayorMejora.delta).toFixed(1)} pts en eliminación directa, mientras que{' '}
              <strong>{mayorCaida.display_name}</strong> cayó {Math.abs(mayorCaida.delta).toFixed(1)} pts
              frente a su nivel en fase de grupos.
            </p>
          )}
        </div>
      )}

      {/* ───── Tabla resumen ───── */}
      <div className="card" style={{ padding: '1.5rem', overflow: 'auto' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>📋 Tabla resumen</h3>
        <table className="ranking-table">
          <thead>
            <tr>
              <th>Participante</th>
              <th>Jugados</th>
              <th>Exactos</th>
              <th>% Exactos</th>
              <th>Ganador</th>
              <th>% Ganador</th>
            </tr>
          </thead>
          <tbody>
            {porExactos.map((j) => (
              <tr key={j.display_name}>
                <td>{j.display_name}</td>
                <td className="rank-points">{j.jugados}</td>
                <td className="rank-points">{j.exactos}</td>
                <td className="rank-points">{j.pct_exactos}%</td>
                <td className="rank-points">{j.ganador}</td>
                <td className="rank-points">{j.pct_ganador}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function KpiCard({ icono, etiqueta, valor, detalle }) {
  return (
    <div
      className="card"
      style={{
        padding: '1.1rem 1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.35rem',
      }}
    >
      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {icono} {etiqueta}
      </span>
      <span style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--gold)', lineHeight: 1.15 }}>
        {valor}
      </span>
      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        {detalle}
      </span>
    </div>
  )
}

function Leaderboard({ titulo, subtitulo, data, campo, campoPct, colorBarra = 'var(--gold)' }) {
  const maxValor = Math.max(...data.map((j) => j[campo]), 1)

  return (
    <div className="card" style={{ padding: '1.5rem' }}>
      <h3 style={{ margin: 0 }}>{titulo}</h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.25rem 0 1.25rem' }}>
        {subtitulo}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        {data.map((j, i) => (
          <div key={j.display_name} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span
              style={{
                width: '1.75rem',
                flexShrink: 0,
                textAlign: 'center',
                fontSize: i < 3 ? '1.1rem' : '0.85rem',
                color: i < 3 ? undefined : 'var(--text-muted)',
              }}
            >
              {medalForRank(i + 1)}
            </span>

            <span style={{ width: '9rem', flexShrink: 0, fontSize: '0.9rem' }}>
              {j.display_name}
            </span>

            <div
              style={{
                flex: 1,
                height: '0.9rem',
                borderRadius: '999px',
                background: 'rgba(255,255,255,0.08)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${(j[campo] / maxValor) * 100}%`,
                  height: '100%',
                  borderRadius: '999px',
                  background: colorBarra,
                  transition: 'width 0.4s ease',
                }}
              />
            </div>

            <span style={{ width: '4.5rem', flexShrink: 0, textAlign: 'right', fontSize: '0.85rem', fontVariantNumeric: 'tabular-nums' }}>
              {j[campo]} <span style={{ color: 'var(--text-muted)' }}>({j[campoPct]}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function FaseMiniCard({ jugador, fases }) {
  const coloresFase = ['var(--gold)', '#4a90d9', '#e67e22', '#27ae60']

  return (
    <div
      style={{
        padding: '0.9rem 1rem',
        borderRadius: '0.6rem',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.6rem' }}>
        {jugador.display_name}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {fases.map((fase, i) => {
          const f = jugador.porFase[fase]
          const pct = f && f.jugados ? Math.round((f.exactos / f.jugados) * 1000) / 10 : 0
          return (
            <div key={fase} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', width: '5.5rem', flexShrink: 0 }}>
                {fase.replace(' de final', '').replace('Fase de ', '')}
              </span>
              <div
                style={{
                  flex: 1,
                  height: '0.5rem',
                  borderRadius: '999px',
                  background: 'rgba(255,255,255,0.08)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: '100%',
                    borderRadius: '999px',
                    background: coloresFase[i % coloresFase.length],
                  }}
                />
              </div>
              <span style={{ fontSize: '0.72rem', width: '2.6rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {pct}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
function ProyeccionDashboard({ loading, data }) {

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader" />
      </div>
    )
  }


  if (!data.length) {
    return (
      <p style={{ color: 'var(--text-muted)' }}>
        No hay datos de proyección disponibles.
      </p>
    )
  }


  return (
    <div className="card" style={{ padding: '1.5rem', overflow: 'auto' }}>

      <h3>
        🚀 Proyección del campeonato
      </h3>

      <p style={{
        color: 'var(--text-muted)',
        fontSize: '0.85rem'
      }}>
        Simulación suponiendo que cada jugador obtiene todos los puntos pendientes posibles.
      </p>


      <table className="ranking-table">

        <thead>
          <tr>
            <th>Jugador</th>
            <th>Puntos actuales</th>
            <th>Máximo posible</th>
            <th>Puesto actual</th>
            <th>Puede llegar</th>
            <th>Oportunidad</th>
            <th>Puede superar</th>
          </tr>
        </thead>


        <tbody>

          {data.map(j => (

            <tr key={j.user_id}>

              <td>
                {j.jugador}
              </td>


              <td className="rank-points">
                {Number(j.puntos_actuales).toFixed(2)}
              </td>


              <td className="rank-points">
                {Number(j.maximo_posible).toFixed(2)}
              </td>


              <td>
                {j.puesto_actual}
              </td>


              <td>
                🏆 {j.puesto_maximo_alcanzable}
              </td>


              <td>
                {Number(j.indice_oportunidad).toFixed(1)}%
              </td>


              <td style={{
                fontSize: '0.85rem'
              }}>
                {j.puede_superar_a}
              </td>


            </tr>

          ))}

        </tbody>

      </table>

    </div>
  )
}