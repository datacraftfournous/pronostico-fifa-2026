import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'

export default function PublicPredictions() {
  const [matches, setMatches] = useState([])
  const [predictions, setPredictions] = useState([])
  const [loading, setLoading] = useState(true)

  const [matchFilter, setMatchFilter] = useState('todos')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)

    const [{ data: matchData }, { data: predData }] = await Promise.all([
      supabase.from('matches').select('*'),
      supabase.from('predictions').select('*')
    ])

    setMatches(matchData || [])
    setPredictions(predData || [])
    setLoading(false)
  }

  const grouped = useMemo(() => {
    const map = {}

    for (const p of predictions) {
      if (!map[p.match_id]) map[p.match_id] = []
      map[p.match_id].push(p)
    }

    return map
  }, [predictions])

  const filteredMatches = useMemo(() => {
    if (matchFilter === 'todos') return matches
    return matches.filter(m => m.group_code === matchFilter)
  }, [matches, matchFilter])

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader" />
      </div>
    )
  }

  return (
    <div>
      <h2 className="page-title">👀 Pronósticos de todos los jugadores</h2>

      {/* FILTER SIMPLE */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <button
          className={matchFilter === 'todos' ? 'tab active' : 'tab'}
          onClick={() => setMatchFilter('todos')}
        >
          Todos los grupos
        </button>
      </div>

      {filteredMatches.map(match => (
        <div key={match.id} className="card" style={{ marginBottom: '1rem' }}>
          <h3>
            {match.home_team} vs {match.away_team}
          </h3>

          <p style={{ color: 'var(--text-muted)' }}>
            {new Date(match.kickoff_at).toLocaleString()}
          </p>

          {/* LISTA DE PRONÓSTICOS */}
          <div style={{ marginTop: '1rem' }}>
            {(grouped[match.id] || []).length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>
                Sin pronósticos aún
              </p>
            ) : (
              grouped[match.id].map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '0.4rem 0',
                    borderBottom: '1px solid #333'
                  }}
                >
                  <strong>{p.user_name || 'Jugador'}</strong>

                  <span>
                    {p.home_score} - {p.away_score}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  )
}