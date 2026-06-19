import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function DailyPrediction() {
  const { user } = useAuth()

  const [matches, setMatches] = useState([])
  const [predictions, setPredictions] = useState({})
  const [loading, setLoading] = useState(true)

  const [groupFilter, setGroupFilter] = useState('todos')
  const [dateFilter, setDateFilter] = useState('todas')

  function getLocalDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-CA', {
      timeZone: 'America/Bogota',
    })
  }

  useEffect(() => {
    if (!user) {
      setMatches([])
      setPredictions({})
      setLoading(false)
      return
    }

    loadData()
  }, [user])

  async function loadData() {
    setLoading(true)

    try {
      const [{ data: matchData }, { data: predData }] = await Promise.all([
        supabase
          .from('matches')
          .select('*')
          .order('kickoff_at', { ascending: true }),

        supabase
          .from('predictions')
          .select('*')
          .eq('user_id', user.id),
      ])

      setMatches(matchData || [])

      const map = {}
      for (const p of predData || []) {
        map[p.match_id] = p
      }

      setPredictions(map)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setDateFilter('todas')
  }, [groupFilter])

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
      result = result.filter(m => getLocalDate(m.kickoff_at) === dateFilter)
    }

    return result.sort(
      (a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at)
    )
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
      <h2 className="page-title">📅 Daily Prediction</h2>

      <p className="page-subtitle">
        Vista tipo reporte de tus pronósticos
      </p>

      {/* FILTROS */}
      <div className="card predictions-filters">
        <div>
          <label className="filter-label">Grupo</label>

          <div className="group-filter">
            <button
              className={groupFilter === 'todos' ? 'group-btn active' : 'group-btn'}
              onClick={() => setGroupFilter('todos')}
            >
              Todos
            </button>

            {'ABCDEFGHIJKL'.split('').map(group => (
              <button
                key={group}
                className={groupFilter === group ? 'group-btn active' : 'group-btn'}
                onClick={() => setGroupFilter(group)}
              >
                {group}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="filter-label">Fecha</label>

          <select
            className="date-select"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          >
            <option value="todas">Todas</option>

            {availableDates.map(date => (
              <option key={date} value={date}>
                {new Date(date + 'T00:00:00').toLocaleDateString('es-CO', {
                  day: '2-digit',
                  month: 'short',
                })}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* TABLA DATAVIZ */}
      <div className="card table-card">
        {filteredMatches.length === 0 ? (
          <div className="empty-state">
            <p>No hay partidos para los filtros seleccionados.</p>
          </div>
        ) : (
          <div className="table">

            {/* HEADER */}
            <div className="table-header">
              <div>Partido</div>
              <div>Fecha</div>
              <div>Pronóstico</div>
              <div>Resultado</div>
            </div>

            {/* ROWS */}
            {filteredMatches.map(match => {
              const pred = predictions[match.id]

              return (
                <div key={match.id} className="table-row">

                  <div className="cell strong">
                    {match.home_team} vs {match.away_team}
                  </div>

                  <div className="cell muted">
                    {new Date(match.kickoff_at).toLocaleString('es-CO', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>

                  <div className="cell prediction">
                    <span>{pred?.home_score ?? '-'}</span>
                    <span className="sep">:</span>
                    <span>{pred?.away_score ?? '-'}</span>
                  </div>

                  <div className="cell result">
                    {match.is_finished ? (
                      <span className="done">
                        {match.home_score}-{match.away_score}
                      </span>
                    ) : (
                      <span className="pending">⏳</span>
                    )}
                  </div>

                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}