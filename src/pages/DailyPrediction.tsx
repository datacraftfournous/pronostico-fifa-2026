import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

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

      // Fecha por defecto: hoy en Colombia, o la fecha más cercana con partidos
      const today = todayInColombia()
      const dates = [...new Set((matchData || []).map(m => getLocalDate(m.kickoff_at)))].sort()

      if (dates.includes(today)) {
        setDateFilter(today)
      } else if (dates.length > 0) {
        // Si hoy no hay partidos, busca la fecha más cercana (futura primero)
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

  // Partidos del día seleccionado (para el selector de hora/partido)
  const matchesOfDay = useMemo(() => {
    return matches
      .filter(m => getLocalDate(m.kickoff_at) === dateFilter)
      .sort((a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at))
  }, [matches, dateFilter])

  // Partidos finales a mostrar (según el filtro de partido/hora)
  const filteredMatches = useMemo(() => {
    if (matchFilter === 'all') return matchesOfDay
    return matchesOfDay.filter(m => String(m.id) === String(matchFilter))
  }, [matchesOfDay, matchFilter])

  // Resetear el filtro de partido cuando cambia la fecha
  useEffect(() => {
    setMatchFilter('all')
  }, [dateFilter])

  // Construir filas: una por cada combinación jugador x partido
  const rows = useMemo(() => {
    const result = []

    for (const match of filteredMatches) {
      for (const profile of profiles) {
        const pred = predictions.find(
          p => p.match_id === match.id && p.user_id === profile.id
        )

        result.push({
          key: `${match.id}-${profile.id}`,
          username: profile.display_name || profile.username,
          matchLabel: `${match.home_team} vs ${match.away_team}`,
          kickoff: match.kickoff_at,
          isFinished: match.is_finished,
          realScore: match.is_finished ? `${match.home_score}-${match.away_score}` : null,
          predScore: pred ? `${pred.home_score}-${pred.away_score}` : '—',
          points: pred?.points ?? (match.is_finished ? 0 : '—'),
        })
      }
    }

    return result
  }, [filteredMatches, profiles, predictions])

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader" />
      </div>
    )
  }

  return (
    <div>
      <h2 className="page-title">📊 Reporte de pronósticos</h2>
      <p className="page-subtitle">Resultados y puntos de todos los jugadores</p>

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

      {/* TABLA */}
      <div className="card">
        {rows.length === 0 ? (
          <div style={{ padding: 20 }}>
            No hay datos para los filtros seleccionados.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="ranking-table">
              <thead>
                <tr>
                  <th>Jugador</th>
                  <th>Partido</th>
                  <th>Resultado real</th>
                  <th>Pronóstico</th>
                  <th>Puntos</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.key}>
                    <td>{row.username}</td>
                    <td>{row.matchLabel}</td>
                    <td>
                      {row.isFinished
                        ? <strong>{row.realScore}</strong>
                        : <span style={{ opacity: 0.6 }}>⏳ Pendiente</span>
                      }
                    </td>
                    <td>{row.predScore}</td>
                    <td>
                      <strong style={{ color: row.isFinished ? 'var(--gold)' : 'var(--text-muted)' }}>
                        {row.points}
                      </strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}