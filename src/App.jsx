import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'

export default function PublicPredictions() {
  const [matches, setMatches] = useState([])
  const [predictions, setPredictions] = useState([])

  const [groupFilter, setGroupFilter] = useState('todos')
  const [dateFilter, setDateFilter] = useState('todas')
  const [loading, setLoading] = useState(true)

  function getLocalDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-CA', {
      timeZone: 'America/Bogota',
    })
  }

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)

    const [{ data: matchData }, { data: predData }] = await Promise.all([
      supabase.from('matches').select('*').order('kickoff_at'),
      supabase.from('predictions').select('*'),
    ])

    setMatches(matchData || [])
    setPredictions(predData || [])
    setLoading(false)
  }

  const groupedByMatch = useMemo(() => {
    const map = {}

    for (const p of predictions) {
      if (!map[p.match_id]) map[p.match_id] = []
      map[p.match_id].push(p)
    }

    return map
  }, [predictions])

  const availableDates = useMemo(() => {
    let source = matches

    if (groupFilter !== 'todos') {
      source = source.filter(m => m.group_code === groupFilter)
    }

    return [...new Set(source.map(m => getLocalDate(m.kickoff_at)))].sort()
  }, [matches, groupFilter])

  const filteredMatches = useMemo(() => {
    let result = [...matches]

    if (groupFilter !== 'todos') {
      result = result.filter(m => m.group_code === groupFilter)
    }

    if (dateFilter !== 'todas') {
      result = result.filter(
        m => getLocalDate(m.kickoff_at) === dateFilter
      )
    }

    return result
  }, [matches, groupFilter, dateFilter])

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader" />
      </div>
    )
  }

  return (
    <div>
      <h2 className="page-title">👀 Pronósticos públicos</h2>

      {/* FILTRO GRUPO */}
      <div className="card">
        <label>Grupo</label>
        <div className="group-filter">
          <button onClick={() => setGroupFilter('todos')}>Todos</button>

          {'ABCDEFGHIJKL'.split('').map(g => (
            <button
              key={g}
              onClick={() => setGroupFilter(g)}
              className={groupFilter === g ? 'active' : ''}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* FILTRO FECHA */}
      <div className="card">
        <label>Fecha</label>
        <div className="date-filter">
          <button onClick={() => setDateFilter('todas')}>
            Todas
          </button>

          {availableDates.map(d => (
            <button
              key={d}
              onClick={() => setDateFilter(d)}
              className={dateFilter === d ? 'active' : ''}
            >
              {new Date(d + 'T00:00:00').toLocaleDateString('es-CO', {
                day: '2-digit',
                month: 'short',
              })}
            </button>
          ))}
        </div>
      </div>

      {/* LISTA */}
      {filteredMatches.map(match => (
        <div key={match.id} className="card">
          <h3>
            {match.home_team} vs {match.away_team}
          </h3>

          <p style={{ color: 'var(--text-muted)' }}>
            Grupo {match.group_code}
          </p>

          <div style={{ marginTop: '1rem' }}>
            {(groupedByMatch[match.id] || []).length === 0 ? (
              <p>No hay pronósticos</p>
            ) : (
              groupedByMatch[match.id].map(p => (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '0.3rem 0',
                    borderBottom: '1px solid #333',
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