import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'


// ───── Configuración del bote ─────
// 15 jugadores × $20.000 cada uno = $300.000
const TOTAL_JUGADORES = 15
const APUESTA_POR_JUGADOR = 20000
const BOTE_TOTAL = TOTAL_JUGADORES * APUESTA_POR_JUGADOR
const PORCENTAJES_PREMIO = [0.5, 0.3, 0.2] // 1°, 2°, 3°

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

// Colores fijos para las barras (rotan si hay más jugadores que colores)
const PALETA_COLORES = [
  '#d4af37', '#4a90d9', '#e67e22', '#27ae60', '#9b59b6',
  '#e74c3c', '#16a085', '#f1c40f', '#2c3e50', '#95a5a6',
  '#3498db', '#c0392b', '#8e44ad', '#2ecc71', '#d35400',
]

// Agrupa las filas crudas de predictions+matches+profiles
// en estadísticas por jugador, tanto globales como por fase (stage).
function calcularEstadisticas(rows) {
  const porJugador = {}

  rows.forEach((row) => {
    const partido = row.matches
    const perfil = row.profiles
    if (!partido || !perfil || !partido.is_finished) return

    const nombre = perfil.display_name
    if (!porJugador[nombre]) {
      porJugador[nombre] = {
        display_name: nombre,
        has_paid: perfil.has_paid,
        jugados: 0,
        exactos: 0,
        ganador: 0,
        porFase: {},
      }
    }

    const jugador = porJugador[nombre]
    const esExacto =
      row.home_score === partido.home_score &&
      row.away_score === partido.away_score
    const esGanador =
      Math.sign(row.home_score - row.away_score) ===
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
  // 'pagos' = ranking oficial que compite por el bote
  // 'general' = clasificación de todos los jugadores por puntos
  // 'analisis' = gráficos de aciertos
  const [vista, setVista] = useState('pagos')

  const [statsJugadores, setStatsJugadores] = useState([])
  const [loadingAnalisis, setLoadingAnalisis] = useState(false)
  const [analisisCargado, setAnalisisCargado] = useState(false)

  // Única fuente de verdad: el puesto se calcula SIEMPRE sobre TODOS
  // los jugadores (pagaron o no), porque todos compitieron por igual.
  // "standings" ya viene ordenado por total desc desde Supabase.
  const rankingConPuestos = calcularPosiciones(standings)

  // Clasificación general: todos, con su puesto real.
  const clasificacionGeneral = rankingConPuestos

  // Ranking de pagos: mismo puesto real, pero solo se muestran
  // (y reciben premio) quienes ya pagaron. Si alguien sin pagar
  // ocupa el puesto 2, verás 1° y luego 3° aquí — es intencional,
  // refleja su posición real en el torneo.
  const jugadoresPagos = rankingConPuestos.filter(p => p.has_paid)
  const jugadoresPendientes = rankingConPuestos.filter(p => !p.has_paid)

  useEffect(() => {
    loadRanking()
  }, [])

  useEffect(() => {
    if (vista === 'analisis' && !analisisCargado) {
      loadAnalisis()
    }
  }, [vista])

  async function loadAnalisis() {
    try {
      setLoadingAnalisis(true)

      const { data, error } = await supabase
        .from('predictions')
        .select(`
          home_score,
          away_score,
          matches!inner ( stage, home_score, away_score, is_finished ),
          profiles!inner ( display_name, has_paid )
        `)

      if (error) {
        console.error(error)
        return
      }

      setStatsJugadores(calcularEstadisticas(data || []))
      setAnalisisCargado(true)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingAnalisis(false)
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

    const esVistaPagos = vista === 'pagos'
    const datos = esVistaPagos ? jugadoresPagos : clasificacionGeneral
    const titulo = esVistaPagos
      ? 'Ranking Mundial FIFA 2026 (Pagos)'
      : 'Clasificación General FIFA 2026 (Todos)'

    doc.setFontSize(22)
    doc.text(titulo, 14, 20)

    doc.setFontSize(11)
    doc.text(
      `Generado: ${new Date().toLocaleString('es-CO')}`,
      14,
      28
    )

    if (esVistaPagos) {
      doc.text(
        `Bote total: ${formatCOP(BOTE_TOTAL)} (${TOTAL_JUGADORES} jugadores x ${formatCOP(APUESTA_POR_JUGADOR)})`,
        14,
        35
      )
    }

    autoTable(doc, {
      startY: esVistaPagos ? 45 : 35,
      head: esVistaPagos
        ? [['Posición', 'Participante', 'Puntos', 'Premio']]
        : [['Posición', 'Participante', 'Puntos', 'Pagó']],
      body: datos.map((player) => esVistaPagos
        ? [player.puesto, player.display_name, player.total, '—']
        : [player.puesto, player.display_name, player.total, player.has_paid ? 'Sí' : 'No']
      ),
      styles: {
        fontSize: 10,
      },
      headStyles: {
        fillColor: [18, 34, 64],
      },
    })

    doc.save(esVistaPagos ? 'ranking-fifa-2026-pagos.pdf' : 'clasificacion-fifa-2026-general.pdf')
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

  const filasAMostrar = vista === 'pagos' ? jugadoresPagos : clasificacionGeneral

  return (
    <div>
      <h2 className="page-title">🏆 Ranking</h2>

      <p className="page-subtitle">
        Clasificación general de la polla · Bote total:{' '}
        {formatCOP(BOTE_TOTAL)} ({TOTAL_JUGADORES} jugadores ×{' '}
        {formatCOP(APUESTA_POR_JUGADOR)})
      </p>

      {/* ───── Selector de vista ───── */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '1rem',
        }}
      >
        <button
          className={vista === 'pagos' ? 'btn btn-gold' : 'btn'}
          onClick={() => setVista('pagos')}
        >
          💰 Ranking (Pagos) {jugadoresPagos.length}
        </button>

        <button
          className={vista === 'general' ? 'btn btn-gold' : 'btn'}
          onClick={() => setVista('general')}
        >
          📊 Clasificación General {standings.length}
        </button>

        <button
          className={vista === 'analisis' ? 'btn btn-gold' : 'btn'}
          onClick={() => setVista('analisis')}
        >
          📈 Análisis
        </button>
      </div>

      {vista === 'pagos' && jugadoresPendientes.length > 0 && (
        <p
          style={{
            fontSize: '0.85rem',
            color: 'var(--text-muted)',
            marginBottom: '1rem',
          }}
        >
          ⚠️ {jugadoresPendientes.length} jugador(es) sin pago registrado no
          aparecen en esta lista (no reciben premio), pero sus puntos sí
          cuentan para el puesto real de los demás — por eso puedes ver
          saltos en la numeración (ej. 1°, luego 3°). Míralos todos en
          "Clasificación General".
        </p>
      )}

      {vista !== 'analisis' && (
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

      {vista !== 'analisis' && (
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
                {vista === 'pagos' ? <th>Premio</th> : <th>Pagó</th>}
              </tr>
            </thead>

            <tbody>
              {filasAMostrar.map((player) => (
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

                  {vista === 'pagos' ? (
                    <td
                      className="rank-points"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      —
                    </td>
                  ) : (
                    <td
                      className="rank-points"
                      style={{
                        color: player.has_paid ? 'var(--gold)' : 'var(--text-muted)',
                      }}
                    >
                      {player.has_paid ? '✅ Sí' : '❌ No'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {vista === 'analisis' && (
        <AnalisisGraficos
          loading={loadingAnalisis}
          stats={statsJugadores}
        />
      )}
    </div>
  )
}

// ───────────────────────────────────────────────
// Componente de análisis: gráficos de aciertos
// ───────────────────────────────────────────────
function AnalisisGraficos({ loading, stats }) {
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

  // Fases disponibles, en el orden en que aparecen en los datos
  const fases = Array.from(
    new Set(stats.flatMap((j) => Object.keys(j.porFase)))
  )

  // Data para el gráfico comparativo por fase: % de acierto exacto
  const dataPorFase = stats
    .map((j) => {
      const fila = { display_name: j.display_name }
      fases.forEach((fase) => {
        const f = j.porFase[fase]
        fila[fase] = f && f.jugados
          ? Math.round((f.exactos / f.jugados) * 1000) / 10
          : 0
      })
      return fila
    })
    .sort((a, b) => (b[fases[0]] || 0) - (a[fases[0]] || 0))

  const coloresFase = ['var(--gold)', '#4a90d9', '#e67e22', '#27ae60']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="card" style={{ padding: '1.5rem' }}>
        <h3 style={{ marginBottom: '0.25rem' }}>🎯 Marcadores exactos acertados</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Cantidad de partidos donde acertaron el marcador exacto (de {stats[0]?.jugados || 0} jugados)
        </p>
        <ResponsiveContainer width="100%" height={Math.max(300, stats.length * 32)}>
          <BarChart data={porExactos} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="display_name" width={110} />
            <Tooltip />
            <Bar dataKey="exactos" name="Aciertos exactos" radius={[0, 4, 4, 0]}>
              {porExactos.map((_, i) => (
                <Cell key={i} fill={PALETA_COLORES[i % PALETA_COLORES.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card" style={{ padding: '1.5rem' }}>
        <h3 style={{ marginBottom: '0.25rem' }}>✅ Ganador acertado (con cualquier marcador)</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Incluye los aciertos exactos, ya que si acertaste el marcador también acertaste el ganador
        </p>
        <ResponsiveContainer width="100%" height={Math.max(300, stats.length * 32)}>
          <BarChart data={porGanador} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="display_name" width={110} />
            <Tooltip />
            <Bar dataKey="ganador" name="Aciertos de ganador" radius={[0, 4, 4, 0]}>
              {porGanador.map((_, i) => (
                <Cell key={i} fill={PALETA_COLORES[i % PALETA_COLORES.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {fases.length > 1 && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '0.25rem' }}>📊 % de acierto exacto por fase</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Compara el rendimiento de cada jugador entre fase de grupos y eliminación directa
          </p>
          <ResponsiveContainer width="100%" height={Math.max(320, stats.length * 40)}>
            <BarChart data={dataPorFase} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" unit="%" />
              <YAxis type="category" dataKey="display_name" width={110} />
              <Tooltip />
              <Legend />
              {fases.map((fase, i) => (
                <Bar
                  key={fase}
                  dataKey={fase}
                  name={fase}
                  fill={coloresFase[i % coloresFase.length]}
                  radius={[0, 4, 4, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="card" style={{ padding: '1.5rem', overflow: 'auto' }}>
        <h3 style={{ marginBottom: '1rem' }}>📋 Tabla resumen</h3>
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
