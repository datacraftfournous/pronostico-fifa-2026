import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getFlag } from '../lib/flags'

export default function DailyPrediction() {
  const [matches, setMatches] = useState([])
  const [predictions, setPredictions] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)

  const [dateFilter, setDateFilter] = useState('')
  const [matchFilter, setMatchFilter] = useState('all')

  function getLocalDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-CA', {
      timeZone: 'America/Bogota',
    })
  }

  function todayInColombia() {
    return new Date().toLocaleDateString('en-CA', {
      timeZone: 'America/Bogota',
    })
  }

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [{ data: matchData }, { data: predData }, { data: profileData }] = await Promise.all([
        supabase.from('matches').select('*').order('kickoff_at', { ascending: true }),
        supabase.from('predictions').select('*'),
        supabase.from('profiles').select('*').order('username'),
      ])

      setMatches(matchData || [])
      setPredictions(predData || [])
      setProfiles(profileData || [])

      const today = todayInColombia()
      const dates = [...new Set((matchData || []).map(m => getLocalDate(m.kickoff_at)))].sort()

      if (dates.includes(today)) {
        setDateFilter(today)
      } else if (dates.length > 0) {
        const futureDate = dates.find(d => d >= today)
        setDateFilter(futureDate || dates[dates.length - 1])
      }
    } finally {
      setLoading(false)
    }
  }

  const availableDates = useMemo(() => {
    return [...new Set(matches.map(m => getLocalDate(m.kickoff_at)))].sort()
  }, [matches])

  const matchesOfDay = useMemo(() => {
    return matches
      .filter(m => getLocalDate(m.kickoff_at) === dateFilter)
      .sort((a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at))
  }, [matches, dateFilter])

  const columnsMatches = useMemo(() => {
    if (matchFilter === 'all') return matchesOfDay
    return matchesOfDay.filter(m => String(m.id) === String(matchFilter))
  }, [matchesOfDay, matchFilter])

  useEffect(() => {
    setMatchFilter('all')
  }, [dateFilter])

  const predMap = useMemo(() => {
    const map = {}
    for (const p of predictions) {
      map[`${p.match_id}-${p.user_id}`] = p
    }
    return map
  }, [predictions])

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader" />
      </div>
    )
  }

  const colWidth = columnsMatches.length > 0
    ? `${Math.max(70 / columnsMatches.length, 6)}%`
    : 'auto'

  return (
    <div>
      <h2 className="page-title">📊 Reporte de pronósticos</h2>
      <p className="page-subtitle">Pronóstico, resultado real y puntos por jugador</p>

      {/* FILTROS */}
      <div className="card predictions-filters">
        <div>
          <label className="filter-label">Fecha</label>
          <select
            className="date-select"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          >
            {availableDates.map(date => (
              <option key={date} value={date}>
                {new Date(date + 'T00:00:00').toLocaleDateString('es-CO', {
                  weekday: 'short',
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="filter-label">Partido / Hora</label>
          <select
            className="date-select"
            value={matchFilter}
            onChange={(e) => setMatchFilter(e.target.value)}
          >
            <option value="all">Todos los partidos del día</option>
            {matchesOfDay.map(m => (
              <option key={m.id} value={m.id}>
                {new Date(m.kickoff_at).toLocaleTimeString('es-CO', {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'America/Bogota',
                })}
                {' — '}{m.home_team} vs {m.away_team}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* TABLA PIVOT */}
      <div className="card" style={{ padding: '0.75rem', overflowX: 'hidden' }}>
        {columnsMatches.length === 0 ? (
          <div style={{ padding: 20 }}>No hay partidos para los filtros seleccionados.</div>
        ) : (
          <table className="pivot-table">
            <colgroup>
              <col style={{ width: '12%' }} />
              {columnsMatches.map(m => <col key={m.id} style={{ width: colWidth }} />)}
            </colgroup>
            <thead>
              <tr>
                <th className="pivot-sticky">Jugador</th>
                {columnsMatches.map(m => (
                  <th key={m.id} title={`${m.home_team} vs ${m.away_team}`}>
                    <div className="pivot-match-header">
                      <div className="pivot-team-block">
                        <span className="pivot-flag">{getFlag(m.home_team)}</span>
                        <span className="pivot-team-name">{m.home_team}</span>
                      </div>
                      <span className="pivot-vs">vs</span>
                      <div className="pivot-team-block">
                        <span className="pivot-flag">{getFlag(m.away_team)}</span>
                        <span className="pivot-team-name">{m.away_team}</span>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {profiles.map(profile => (
                <tr key={profile.id}>
                  <td className="pivot-sticky pivot-player">
                    {profile.display_name || profile.username}
                  </td>
                  {columnsMatches.map(m => {
                    const pred = predMap[`${m.id}-${profile.id}`]
                    const isFinished = m.is_finished

                    return (
                      <td key={m.id} className="pivot-cell">
                        <div className="pivot-cell-content">
                          <div className="pivot-pred-real">
                            <span className="pivot-pred">
                              {pred ? `${pred.home_score}-${pred.away_score}` : '—'}
                            </span>
                            <span className="pivot-divider">|</span>
                            <span className="pivot-real">
                              {isFinished ? `${m.home_score}-${m.away_score}` : '⏳'}
                            </span>
                          </div>
                          <span
                            className="pivot-points"
                            style={{ color: isFinished ? 'var(--gold)' : 'var(--text-muted)' }}
                          >
                            {isFinished ? (pred?.points ?? 0) : '—'}
                          </span>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}