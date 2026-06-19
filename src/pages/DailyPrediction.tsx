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
    loadData()
  }, [user])

  async function loadData() {
    if (!user) return

    setLoading(true)

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

    setLoading(false)
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
      result = result.filter(
        m => getLocalDate(m.kickoff_at) === dateFilter
      )
    }

    result.sort(
      (a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at)
    )

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
      <h2 className="page-title">📅 Daily Prediction</h2>

      <p className="page-subtitle">
        Consulta tus pronósticos por fecha y grupo
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

          <div className="date-filter">
            <button
              className={dateFilter === 'todas' ? 'date-btn active' : 'date-btn'}
              onClick={() => setDateFilter('todas')}
            >
              Todas
            </button>

            {availableDates.map(date => (
              <button
                key={date}
                className={dateFilter === date ? 'date-btn active' : 'date-btn'}
                onClick={() => setDateFilter(date)}
              >
                {new Date(date + 'T00:00:00').toLocaleDateString('es-CO', {
                  day: '2-digit',
                  month: 'short',
                })}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TABLA COMPACTA */}
      <div className="card" style={{ padding: 10 }}>
        <div className="compact-table">

          {filteredMatches.length === 0 ? (
            <div className="empty-state">
              <p>No hay partidos para los filtros seleccionados.</p>
            </div>
          ) : (
            filteredMatches.map(match => {
              const pred = predictions[match.id]

              return (
                <div key={match.id} className="compact-row">

                  <div className="compact-left">
                    <div className="stage">{match.stage}</div>

                    <div className="teams">
                      {match.home_team}
                      <span className="vs">vs</span>
                      {match.away_team}
                    </div>

                    <div className="date">
                      🇨🇴 {new Date(match.kickoff_at).toLocaleString('es-CO', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>

                  <div className="compact-center">
                    <input
                      className="mini-input"
                      value={pred?.home_score ?? ''}
                      disabled
                    />
                    <span className="vs">:</span>
                    <input
                      className="mini-input"
                      value={pred?.away_score ?? ''}
                      disabled
                    />
                  </div>

                  <div className="compact-right">
                    {match.is_finished ? (
                      <span className="result">
                        {match.home_score}-{match.away_score}
                      </span>
                    ) : (
                      <span className="pending">⏳</span>
                    )}
                  </div>

                </div>
              )
            })
          )}

        </div>
      </div>
    </div>
  )
}