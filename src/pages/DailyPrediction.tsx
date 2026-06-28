import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getFlagUrl } from '../lib/flags'
import { canEditAnyPrediction } from '../lib/scoring'

function Flag({ team }) {
  const url = getFlagUrl(team)
  if (!url) return null
  return <img src={url} alt={team} title={team} className="pivot-flag-img" />
}

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

  // 🔒 BLINDAJE: solo partidos ya bloqueados para edición (o finalizados)
  // pueden aparecer en el reporte. Si todavía se puede editar, se oculta
  // por completo para que nadie vea pronósticos ajenos antes de tiempo.
  const visibleMatchesOfDay = useMemo(() => {
    return matchesOfDay.filter(m => m.is_finished || !canEditAnyPrediction(m))
  }, [matchesOfDay])

  const columnsMatches = useMemo(() => {
    if (matchFilter === 'all') return visibleMatchesOfDay
    return visibleMatchesOfDay.filter(m => String(m.id) === String(matchFilter))
  }, [visibleMatchesOfDay, matchFilter])

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
    ? `${Math.max(70 / columnsMatches.length, 8)}%`
    : 'auto'

  const ocultos = matchesOfDay.length - visibleMatchesOfDay.length

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
            <option value="all">Todos los partidos visibles del día</option>
            {visibleMatchesOfDay.map(m => (
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

      {/* LEYENDA */}
      <div className="pivot-legend">
        <span><strong>Pron</strong> = Pronóstico</span>
        <span><strong>Real</strong> = Resultado real</span>
        <span><strong>Pts</strong> = Puntos obtenidos</span>
      </div>

      {ocultos > 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.5rem 0' }}>
          🔒 {ocultos} partido{ocultos > 1 ? 's' : ''} de este día aún {ocultos > 1 ? 'están' : 'está'} abierto{ocultos > 1 ? 's' : ''} a pronósticos y no se muestra{ocultos > 1 ? 'n' : ''} todavía.
        </p>
      )}

      {/* TABLA PIVOT */}
      <div className="card" style={{ padding: '0.75rem', overflowX: 'hidden' }}>
        {columnsMatches.length === 0 ? (
          <div style={{ padding: 20 }}>
            No hay partidos visibles para los filtros seleccionados (los partidos abiertos a pronóstico se ocultan hasta que cierren).
          </div>
        ) : (
          <table className="pivot-table">
            <colgroup>
              <col style={{ width: '14%' }} />
              {columnsMatches.map(m => <col key={m.id} style={{ width: colWidth }} />)}
            </colgroup>
            <thead>
              <tr>
                <th className="pivot-sticky" rowSpan={2}>Jugador</th>
                {columnsMatches.map(m => (
                  <th key={m.id} title={`${m.home_team} vs ${m.away_team}`}>
                    <div className="pivot-match-header">
                      <Flag team={m.home_team} />
                      <span className="pivot-vs">vs</span>
                      <Flag team={m.away_team} />
                    </div>
                  </th>
                ))}
              </tr>
              <tr>
                {columnsMatches.map(m => (
                  <th key={`sub-${m.id}`} className="pivot-subheader">
                    <span>Pron</span>
                    <span>Real</span>
                    <span>Pts</span>
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
                          <span className="pivot-pred">
                            {pred ? `${pred.home_score}-${pred.away_score}` : '—'}
                          </span>
                          <span className="pivot-real">
                            {isFinished ? `${m.home_score}-${m.away_score}` : 'Pend.'}
                          </span>
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
