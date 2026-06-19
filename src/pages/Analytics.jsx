import { useEffect, useMemo, useState } from 'react'
import { Bar, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { supabase } from '../lib/supabase'
import { getFlagUrl } from '../lib/flags'

ChartJS.register(BarElement, CategoryScale, LinearScale, ArcElement, Tooltip, Legend)

function Flag({ team }) {
  const url = getFlagUrl(team)
  if (!url) return null
  return <img src={url} alt={team} className="analytics-flag" />
}

export default function Analytics() {
  const [matches, setMatches] = useState([])
  const [predictions, setPredictions] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)

  const [dateFilter, setDateFilter] = useState('')
  const [matchFilter, setMatchFilter] = useState('')

  function getLocalDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  }

  function todayInColombia() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
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
      const defaultDate = dates.includes(today) ? today : (dates.find(d => d >= today) || dates[dates.length - 1])
      setDateFilter(defaultDate || '')
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

  // Seleccionar automáticamente el primer partido del día al cambiar fecha
  useEffect(() => {
    if (matchesOfDay.length > 0) {
      setMatchFilter(String(matchesOfDay[0].id))
    } else {
      setMatchFilter('')
    }
  }, [dateFilter, matchesOfDay.length])

  const selectedMatch = useMemo(() => {
    return matches.find(m => String(m.id) === String(matchFilter)) || null
  }, [matches, matchFilter])

  const matchPredictions = useMemo(() => {
    if (!selectedMatch) return []
    return predictions
      .filter(p => p.match_id === selectedMatch.id)
      .map(p => {
        const profile = profiles.find(pr => pr.id === p.user_id)
        return {
          ...p,
          username: profile?.display_name || profile?.username || '—',
        }
      })
  }, [selectedMatch, predictions, profiles])

  // ===== ANÁLISIS =====
  const analysis = useMemo(() => {
    if (!selectedMatch || matchPredictions.length === 0) return null

    // Distribución de marcadores exactos pronosticados
    const scoreCounts = {}
    let totalHome = 0, totalAway = 0
    let homeVotes = 0, awayVotes = 0, drawVotes = 0

    for (const p of matchPredictions) {
      const key = `${p.home_score}-${p.away_score}`
      scoreCounts[key] = (scoreCounts[key] || 0) + 1
      totalHome += p.home_score
      totalAway += p.away_score

      if (p.home_score > p.away_score) homeVotes++
      else if (p.home_score < p.away_score) awayVotes++
      else drawVotes++
    }

    const sortedScores = Object.entries(scoreCounts).sort((a, b) => b[1] - a[1])
    const topScore = sortedScores[0]
    const total = matchPredictions.length

    const avgHome = (totalHome / total).toFixed(1)
    const avgAway = (totalAway / total).toFixed(1)

    let favorite = 'Empate'
    let favoriteVotes = drawVotes
    if (homeVotes >= awayVotes && homeVotes >= drawVotes) {
      favorite = selectedMatch.home_team
      favoriteVotes = homeVotes
    } else if (awayVotes >= homeVotes && awayVotes >= drawVotes) {
      favorite = selectedMatch.away_team
      favoriteVotes = awayVotes
    }

    // Aciertos (solo si el partido ya terminó)
    let exactCount = 0, winnerCount = 0, missCount = 0
    if (selectedMatch.is_finished) {
      const realDiff = Math.sign(selectedMatch.home_score - selectedMatch.away_score)
      for (const p of matchPredictions) {
        const predDiff = Math.sign(p.home_score - p.away_score)
        if (p.home_score === selectedMatch.home_score && p.away_score === selectedMatch.away_score) {
          exactCount++
        } else if (predDiff === realDiff) {
          winnerCount++
        } else {
          missCount++
        }
      }
    }

    return {
      topScore, sortedScores, avgHome, avgAway,
      favorite, favoriteVotes, total,
      homeVotes, awayVotes, drawVotes,
      exactCount, winnerCount, missCount,
    }
  }, [selectedMatch, matchPredictions])

  // Ranking de mejor racha (todos los partidos finalizados)
  const ranking = useMemo(() => {
    return profiles
      .map(p => ({
        username: p.display_name || p.username,
        points: p.total_points || 0,
      }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 5)
  }, [profiles])

  if (loading) {
    return <div className="loading-screen"><div className="loader" /></div>
  }

  return (
    <div>
      <h2 className="page-title">📈 Análisis del partido</h2>
      <p className="page-subtitle">Qué pronosticó la gente, partido por partido</p>

      {/* FILTROS */}
      <div className="card predictions-filters">
        <div>
          <label className="filter-label">Fecha</label>
          <select className="date-select" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
            {availableDates.map(date => (
              <option key={date} value={date}>
                {new Date(date + 'T00:00:00').toLocaleDateString('es-CO', {
                  weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
                })}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="filter-label">Partido</label>
          <select className="date-select" value={matchFilter} onChange={(e) => setMatchFilter(e.target.value)}>
            {matchesOfDay.map(m => (
              <option key={m.id} value={m.id}>
                {new Date(m.kickoff_at).toLocaleTimeString('es-CO', {
                  hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota',
                })}
                {' — '}{m.home_team} vs {m.away_team}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!selectedMatch || !analysis ? (
        <div className="card"><div style={{ padding: 20 }}>No hay pronósticos para este partido aún.</div></div>
      ) : (
        <>
          {/* HEADER DEL PARTIDO */}
          <div className="card analytics-match-header">
            <Flag team={selectedMatch.home_team} />
            <span style={{ fontWeight: 700 }}>{selectedMatch.home_team}</span>
            <span style={{ opacity: 0.5 }}>vs</span>
            <span style={{ fontWeight: 700 }}>{selectedMatch.away_team}</span>
            <Flag team={selectedMatch.away_team} />
            {selectedMatch.is_finished && (
              <span className="badge badge-finalizado" style={{ marginLeft: '0.75rem' }}>
                Real: {selectedMatch.home_score}-{selectedMatch.away_score}
              </span>
            )}
          </div>

          {/* KPIs */}
          <div className="analytics-kpi-grid">
            <div className="analytics-kpi">
              <span className="analytics-kpi-label">Marcador más votado</span>
              <span className="analytics-kpi-value">{analysis.topScore[0]}</span>
              <span className="analytics-kpi-sub">{analysis.topScore[1]} de {analysis.total} jugadores</span>
            </div>
            <div className="analytics-kpi">
              <span className="analytics-kpi-label">Favorito de la mayoría</span>
              <span className="analytics-kpi-value">{analysis.favorite}</span>
              <span className="analytics-kpi-sub">{analysis.favoriteVotes} de {analysis.total} votos</span>
            </div>
            <div className="analytics-kpi">
              <span className="analytics-kpi-label">Promedio pronosticado</span>
              <span className="analytics-kpi-value">{analysis.avgHome} - {analysis.avgAway}</span>
            </div>
            {selectedMatch.is_finished && (
              <div className="analytics-kpi">
                <span className="analytics-kpi-label">Acertaron el exacto</span>
                <span className="analytics-kpi-value" style={{ color: 'var(--gold)' }}>{analysis.exactCount}</span>
                <span className="analytics-kpi-sub">de {analysis.total} jugadores</span>
              </div>
            )}
          </div>

          {/* GRÁFICO: Distribución de marcadores */}
          <div className="card" style={{ marginTop: '1rem' }}>
            <h3 style={{ color: 'var(--gold)', fontSize: '1rem', marginBottom: '1rem' }}>
              Distribución de marcadores pronosticados
            </h3>
            <div style={{ position: 'relative', height: '220px' }}>
              <Bar
                data={{
                  labels: analysis.sortedScores.map(([score]) => score),
                  datasets: [{
                    label: 'Jugadores',
                    data: analysis.sortedScores.map(([, count]) => count),
                    backgroundColor: '#00c853',
                    borderRadius: 4,
                  }],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1, color: '#94a3b8' }, grid: { color: '#1e3a5f' } },
                    x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
                  },
                }}
              />
            </div>
          </div>

          {/* GRÁFICO: Quién favorece a quién */}
          <div className="card" style={{ marginTop: '1rem' }}>
            <h3 style={{ color: 'var(--gold)', fontSize: '1rem', marginBottom: '1rem' }}>
              ¿A quién le apostaron como ganador?
            </h3>
            <div style={{ position: 'relative', height: '200px', maxWidth: '280px', margin: '0 auto' }}>
              <Doughnut
                data={{
                  labels: [selectedMatch.home_team, 'Empate', selectedMatch.away_team],
                  datasets: [{
                    data: [analysis.homeVotes, analysis.drawVotes, analysis.awayVotes],
                    backgroundColor: ['#00c853', '#94a3b8', '#ffd700'],
                    borderWidth: 0,
                  }],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom',
                      labels: { color: '#f0f4f8', font: { size: 11 }, boxWidth: 12 },
                    },
                  },
                }}
              />
            </div>
          </div>

          {/* RESULTADOS DE ACIERTO (solo si finalizó) */}
          {selectedMatch.is_finished && (
            <div className="card" style={{ marginTop: '1rem' }}>
              <h3 style={{ color: 'var(--gold)', fontSize: '1rem', marginBottom: '1rem' }}>
                Nivel de acierto de los jugadores
              </h3>
              <div style={{ position: 'relative', height: '160px' }}>
                <Bar
                  data={{
                    labels: ['Exacto', 'Ganador', 'Falló'],
                    datasets: [{
                      data: [analysis.exactCount, analysis.winnerCount, analysis.missCount],
                      backgroundColor: ['#ffd700', '#00c853', '#ef4444'],
                      borderRadius: 4,
                    }],
                  }}
                  options={{
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      x: { beginAtZero: true, ticks: { stepSize: 1, color: '#94a3b8' }, grid: { color: '#1e3a5f' } },
                      y: { ticks: { color: '#f0f4f8' }, grid: { display: false } },
                    },
                  }}
                />
              </div>
            </div>
          )}

          {/* TABLA DETALLE: qué dijo cada jugador */}
          <div className="card" style={{ marginTop: '1rem' }}>
            <h3 style={{ color: 'var(--gold)', fontSize: '1rem', marginBottom: '1rem' }}>
              Pronóstico de cada jugador
            </h3>
            <table className="ranking-table">
              <thead>
                <tr><th>Jugador</th><th>Pronóstico</th></tr>
              </thead>
              <tbody>
                {matchPredictions
                  .slice()
                  .sort((a, b) => a.username.localeCompare(b.username))
                  .map(p => (
                    <tr key={p.id}>
                      <td>{p.username}</td>
                      <td><strong>{p.home_score}-{p.away_score}</strong></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* TOP 5 RANKING GENERAL */}
          <div className="card" style={{ marginTop: '1rem' }}>
            <h3 style={{ color: 'var(--gold)', fontSize: '1rem', marginBottom: '1rem' }}>
              🏆 Top 5 general (todos los partidos)
            </h3>
            <table className="ranking-table">
              <thead>
                <tr><th>#</th><th>Jugador</th><th>Puntos</th></tr>
              </thead>
              <tbody>
                {ranking.map((r, i) => (
                  <tr key={r.username}>
                    <td>{i + 1}</td>
                    <td>{r.username}</td>
                    <td className="rank-points">{r.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}