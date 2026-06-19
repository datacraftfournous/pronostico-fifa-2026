import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function DailyPrediction() {
  const { user } = useAuth()

  const [matches, setMatches] = useState([])
  const [predictions, setPredictions] = useState({})
  const [loading, setLoading] = useState(true)

  const [groupFilter, setGroupFilter] = useState('todos')
  const [dateFilter, setDateFilter] = useState('all')

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

    if (dateFilter !== 'all') {
      result = result.filter(
        m => getLocalDate(m.kickoff_at) === dateFilter
      )
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
        Vista tipo reporte con filtros dinámicos
      </p>

      {/* FILTROS */}
      <div className="card predictions-filters">

        {/* GRUPO */}
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

        {/* SLICER FECHA */}
        <div>
          <label className="filter-label">Fecha (Slicer)</label>

          <select
            className="date-select"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          >
            <option value="all">Todas las fechas</option>

            {availableDates.map(date => (
              <option key={date} value={date}>
                {new Date(date + 'T00:00:00').toLocaleDateString('es-CO', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </option>
            ))}
          </select>
        </div>

      </div>

      {/* TABLA DATAVIZ */}
      <div className="card">

        {filteredMatches.length === 0 ? (
          <div style={{ padding: 20 }}>
            No hay partidos para los filtros seleccionados.
          </div>
        ) : (

          <div>

            {/* HEADER */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1fr',
                padding: '10px',
                fontSize: 12,
                fontWeight: 600,
                opacity: 0.6,
                borderBottom: '1px solid #ddd'
              }}
            >
              <div>Partido</div>
              <div>Fecha</div>
              <div>Pronóstico</div>
              <div>Resultado</div>
            </div>

            {/* ROWS */}
            {filteredMatches.map(match => {
              const pred = predictions[match.id]

              return (
                <div
                  key={match.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1fr 1fr',
                    padding: '10px',
                    borderBottom: '1px solid #eee',
                    fontSize: 13,
                    alignItems: 'center'
                  }}
                >

                  <div style={{ fontWeight: 600 }}>
                    {match.home_team} vs {match.away_team}
                  </div>

                  <div style={{ opacity: 0.7, fontSize: 12 }}>
                    {new Date(match.kickoff_at).toLocaleString('es-CO', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>

                  <div style={{ fontWeight: 600 }}>
                    {pred?.home_score ?? '-'} : {pred?.away_score ?? '-'}
                  </div>

                  <div>
                    {match.is_finished ? (
                      <span style={{ fontWeight: 700 }}>
                        {match.home_score}-{match.away_score}
                      </span>
                    ) : (
                      <span style={{ opacity: 0.6 }}>⏳</span>
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