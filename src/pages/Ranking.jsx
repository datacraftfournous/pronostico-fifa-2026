import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { calcularPremios } from '../lib/scoring'

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

export default function Ranking() {
  const [standings, setStandings] = useState([])
  const [loading, setLoading] = useState(true)

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

  // Premios calculados con manejo de empates (regla estándar de quinielas:
  // si varios empatan y ocupan varios puestos premiados, se suman esos
  // porcentajes y se dividen en partes iguales entre los empatados).
  const premiosPorId = (() => {
    const premios = calcularPremios(standings, BOTE_TOTAL, PORCENTAJES_PREMIO)
    const map = {}
    for (const p of premios) {
      map[p.id] = { puesto: p.puesto, premio: p.premio }
    }
    return map
  })()

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
      body: standings.map((player, index) => {
        const premioInfo = premiosPorId[player.id]
        return [
          premioInfo ? premioInfo.puesto : index + 1,
          player.display_name,
          player.total,
          premioInfo ? formatCOP(premioInfo.premio) : '—',
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
        Clasificación general de la polla · Bote total: {formatCOP(BOTE_TOTAL)} ({TOTAL_JUGADORES} jugadores × {formatCOP(APUESTA_POR_JUGADOR)})
      </p>

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
              <th>Premio</th>
            </tr>
          </thead>

          <tbody>
            {standings.map((player, index) => {
              const premioInfo = premiosPorId[player.id]

              return (
                <tr key={player.id}>
                  <td className="rank-medal">
                    {medalForRank(premioInfo ? premioInfo.puesto : index + 1)}
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

                  <td className="rank-points" style={{ color: premioInfo ? 'var(--green)' : 'var(--text-muted)' }}>
                    {premioInfo ? formatCOP(premioInfo.premio) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
