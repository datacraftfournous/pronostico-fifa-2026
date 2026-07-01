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
    const rankingConPuestos = calcularPosiciones(standings)

const jugadoresPagos = rankingConPuestos.filter(p => p.has_paid)
const jugadoresPendientes = rankingConPuestos.filter(p => !p.has_paid)

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

        console.log(data)
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
    body: jugadoresPagos.map((player) => [
      player.puesto,
      player.display_name,
      player.total,
      '—',
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
          Clasificación general de la polla · Bote total:{' '}
          {formatCOP(BOTE_TOTAL)} ({TOTAL_JUGADORES} jugadores ×{' '}
          {formatCOP(APUESTA_POR_JUGADOR)})
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
              {rankingConPuestos.map((player) => {
                

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
    style={{ color: 'var(--text-muted)' }}
  >
    —
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


  <div className="card" style={{ marginTop: '2rem' }}>
  <h3>💰 Estado de pagos</h3>

  <div className="admin-grid admin-grid-2">

    <div>
      <h4 style={{ color: 'var(--green)' }}>
        ✅ Han pagado ({jugadoresPagos.length})
      </h4>

      <table className="ranking-table">
        <tbody>
          {jugadoresPagos.map(p => (
            <tr key={p.id}>
              <td>{p.display_name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div>
      <h4 style={{ color: '#ef4444' }}>
        ❌ Pendientes ({jugadoresPendientes.length})
      </h4>

      <table className="ranking-table">
        <tbody>
          {jugadoresPendientes.map(p => (
            <tr key={p.id}>
              <td>{p.display_name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

  </div>
</div>