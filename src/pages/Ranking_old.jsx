import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

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
    setLoading(true)

    const [{ data: profiles }, { data: predictions }] = await Promise.all([
      supabase.from('profiles').select('id, username, display_name, role').order('display_name'),
      supabase.from('predictions').select('user_id, points'),
    ])

    const totals = {}
    for (const p of profiles || []) {
      totals[p.id] = { ...p, total: 0 }
    }
    for (const pred of predictions || []) {
      if (totals[pred.user_id]) {
        totals[pred.user_id].total += pred.points || 0
      }
    }

    const sorted = Object.values(totals)
      .filter((p) => p.role !== 'admin' || true)
      .sort((a, b) => b.total - a.total)

    setStandings(sorted)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="loading-screen" style={{ minHeight: '200px' }}>
        <div className="loader" />
      </div>
    )
  }

  return (
    <div>
      <h2 className="page-title">🏆 Ranking</h2>
      <p className="page-subtitle">Clasificación general de la polla</p>

      {standings.length === 0 ? (
        <div className="empty-state card">
          <div className="icon">⚽</div>
          <p>Aún no hay participantes registrados.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
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
                  <td className="rank-medal">{medalForRank(index + 1)}</td>
                  <td>
                    {player.display_name}
                    {player.role === 'admin' && (
                      <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--gold)' }}>
                        (Admin)
                      </span>
                    )}
                  </td>
                  <td className="rank-points">{player.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
