import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

function medalForRank(rank) {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return rank
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

    autoTable(doc, {
      startY: 40,
      head: [['Posición', 'Participante', 'Puntos']],
      body: standings.map((player, index) => [
        index + 1,
        player.display_name,
        player.total,
      ]),
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
        Clasificación general de la polla
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
            </tr>
          </thead>

          <tbody>
            {standings.map((player, index) => (
              <tr key={player.id}>
                <td className="rank-medal">
                  {medalForRank(index + 1)}
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}