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

export default function Ranking() {
  const [standings, setStandings] = useState([])
  const [loading, setLoading] = useState(true)
  // 'pagos' = ranking oficial que compite por el bote
  // 'general' = clasificación de todos los jugadores por puntos
  const [vista, setVista] = useState('pagos')

  const rankingConPuestos = calcularPosiciones(standings)

  const jugadoresPagos = rankingConPuestos.filter(p => p.has_paid)
  const jugadoresPendientes = rankingConPuestos.filter(p => !p.has_paid)

  // Clasificación general: TODOS los jugadores, recalculando puesto
  // solo entre ellos (independiente de si pagaron o no).
  const clasificacionGeneral = calcularPosiciones(
    [...standings].sort((a, b) => Number(b.total) - Number(a.total))
  )

  useEffect(() => {
    loadRanking()
  }, [])

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
      </div>

      {vista === 'pagos' && jugadoresPendientes.length > 0 && (
        <p
          style={{
            fontSize: '0.85rem',
            color: 'var(--text-muted)',
            marginBottom: '1rem',
          }}
        >
          ⚠️ {jugadoresPendientes.length} jugador(es) sin pago registrado, no
          aparecen en esta lista. Puedes verlos en "Clasificación General".
        </p>
      )}

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
    </div>
  )
}
