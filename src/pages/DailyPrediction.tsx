import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import MatchCard from '../components/MatchCard'

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

    const predMap = {}
    for (const p of predData || []) {
      predMap[p.match_id] = p
    }

    setPredictions(predMap)

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
      <div className="loading-screen" style={{ minHeight: '200px' }}>
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

      {/* FILTROS (MISMO ESTILO QUE TU APP) */}
      <div className="card predictions-filters">
        <div>
          <label className="filter-label">Grupo</label>

          <div className="group-filter">
            <button
              type="button"
              className={groupFilter === 'todos' ? 'group-btn active' : 'group-btn'}
              onClick={() => setGroupFilter('todos')}
            >
              Todos
            </button>

            {'ABCDEFGHIJKL'.split('').map(group => (
              <button
                key={group}
                type="button"
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
              type="button"
              className={dateFilter === 'todas' ? 'date-btn active' : 'date-btn'}
              onClick={() => setDateFilter('todas')}
            >
              Todas
            </button>

            {availableDates.map(date => (
              <button
                key={date}
                type="button"
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

      {/* MATCHES */}
      {filteredMatches.length === 0 ? (
        <div className="empty-state card">
          <div className="icon">📅</div>
          <p>No hay partidos para los filtros seleccionados.</p>
        </div>
      ) : (
        filteredMatches.map(match => (
          <MatchCard
            key={match.id}
            match={match}
            prediction={predictions[match.id]}
            showPoints={false}
            readOnly={true}
          />
        ))
      )}
    </div>
  )
}