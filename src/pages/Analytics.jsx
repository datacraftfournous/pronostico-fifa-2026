import { useEffect, useMemo, useState } from 'react'
import { Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { supabase } from '../lib/supabase'
import { getFlagUrl } from '../lib/flags'

ChartJS.register(ArcElement, Tooltip, Legend)

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
    const [{ data: matchData }, { data: profileData }] = await Promise.all([
      supabase
        .from('matches')
        .select('*')
        .order('kickoff_at', { ascending: true }),

      supabase
        .from('profiles')
        .select('*')
        .order('username'),
    ])

    // Traer TODAS las predicciones sin importar el límite de 1000 filas
    const pageSize = 1000
    let from = 0
    let allPredictions = []

    while (true) {
      const { data, error } = await supabase
        .from('predictions')
        .select('*')
        .range(from, from + pageSize - 1)

      if (error) throw error

      if (!data || data.length === 0) break

      allPredictions.push(...data)

      if (data.length < pageSize) break

      from += pageSize
    }

    setMatches(matchData || [])
    setProfiles(profileData || [])
    setPredictions(allPredictions)

    const today = todayInColombia()
    const dates = [...new Set((matchData || []).map(m => getLocalDate(m.kickoff_at)))].sort()

    const defaultDate = dates.includes(today)
      ? today
      : (dates.find(d => d >= today) || dates[dates.length - 1])

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

    const scoreCounts = {}
    let totalHome = 0, totalAway = 0
    let homeVotes = 0, awayVotes = 0, drawVotes = 0
    let cleanSheetHome = 0, cleanSheetAway = 0

    for (const p of matchPredictions) {
      const key = `${p.home_score}-${p.away_score}`
      scoreCounts[key] = (scoreCounts[key] || 0) + 1
      totalHome += p.home_score
      totalAway += p.away_score

      if (p.home_score > p.away_score) homeVotes++
      else if (p.home_score < p.away_score) awayVotes++
      else drawVotes++

      if (p.away_score === 0) cleanSheetHome++
      if (p.home_score === 0) cleanSheetAway++
    }

    const sortedScores = Object.entries(scoreCounts).sort((a, b) => b[1] - a[1])
    const topScore = sortedScores[0]
    const total = matchPredictions.length

    const avgHome = (totalHome / total).toFixed(2)
    const avgAway = (totalAway / total).toFixed(2)
    const avgDiff = (totalHome / total) - (totalAway / total)

    const homePct = Math.round((homeVotes / total) * 100)
    const awayPct = Math.round((awayVotes / total) * 100)
    const drawPct = Math.round((drawVotes / total) * 100)
    const cleanSheetHomePct = Math.round((cleanSheetHome / total) * 100)
    const cleanSheetAwayPct = Math.round((cleanSheetAway / total) * 100)

    // Mayor diferencia esperada (a favor del local) y predicción más conservadora
    const withDiff = matchPredictions.map(p => ({
      ...p,
      diff: p.home_score - p.away_score,
      totalGoals: p.home_score + p.away_score,
    }))

    const biggestHomeDiff = [...withDiff].sort((a, b) => b.diff - a.diff).slice(0, 2)
    const biggestAwayDiff = [...withDiff].sort((a, b) => a.diff - b.diff).slice(0, 2)
    const mostConservative = [...withDiff].sort((a, b) => a.totalGoals - b.totalGoals).slice(0, 2)

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

    // ===== INSIGHTS GENERADOS CON REGLAS =====
    const insights = []

    if (homePct === 100 || awayPct === 100) {
      const team = homePct === 100 ? selectedMatch.home_team : selectedMatch.away_team
      insights.push({
        icon: '🏆',
        title: `Confianza absoluta en ${team}`,
        text: `Ningún participante apostó por empate o derrota. Existe consenso total de que ${team} ganará el encuentro.`,
      })
    } else if (Math.max(homePct, awayPct, drawPct) >= 70) {
      const leader = homePct >= awayPct && homePct >= drawPct ? selectedMatch.home_team
        : awayPct >= drawPct ? selectedMatch.away_team : 'el empate'
      const pct = Math.max(homePct, awayPct, drawPct)
      insights.push({
        icon: '📊',
        title: `Mayoría clara a favor de ${leader}`,
        text: `${pct}% de los participantes coinciden en este resultado.`,
      })
    } else {
      insights.push({
        icon: '🤔',
        title: 'Pronósticos divididos',
        text: `No hay consenso claro: ${homePct}% favorece a ${selectedMatch.home_team}, ${awayPct}% a ${selectedMatch.away_team}, ${drawPct}% espera empate.`,
      })
    }

    if (cleanSheetHomePct >= 60) {
      insights.push({
        icon: '🛡️',
        title: 'Defensa sólida esperada',
        text: `${cleanSheetHome} de los ${total} participantes creen que ${selectedMatch.away_team} no anotará. ${cleanSheetHomePct}% espera arco en cero para ${selectedMatch.home_team}.`,
      })
    } else if (cleanSheetAwayPct >= 60) {
      insights.push({
        icon: '🛡️',
        title: 'Defensa sólida esperada',
        text: `${cleanSheetAway} de los ${total} participantes creen que ${selectedMatch.home_team} no anotará. ${cleanSheetAwayPct}% espera arco en cero para ${selectedMatch.away_team}.`,
      })
    }

    const highScoring = matchPredictions.filter(p => (p.home_score + p.away_score) >= 3).length
    const highScoringPct = Math.round((highScoring / total) * 100)
    if (highScoringPct >= 50) {
      insights.push({
        icon: '⚽',
        title: 'Se esperan varios goles',
        text: `${highScoring} de los ${total} pronósticos proyectan 3 goles o más en total.`,
      })
    }

    const concentration = Math.round((topScore[1] / total) * 100)
    if (concentration >= 30) {
      insights.push({
        icon: '🎯',
        title: 'Alta concentración de predicciones',
        text: `Los resultados se concentran principalmente en pocos marcadores, mostrando una percepción muy similar entre los jugadores.`,
      })
    } else {
      insights.push({
        icon: '🌈',
        title: 'Predicciones muy variadas',
        text: `Los participantes tienen visiones distintas: ${sortedScores.length} marcadores diferentes fueron pronosticados.`,
      })
    }

    // Insight principal (resumen final)
    let mainInsight = ''
    const leaderTeam = homePct >= awayPct && homePct > drawPct ? selectedMatch.home_team
      : awayPct > homePct && awayPct > drawPct ? selectedMatch.away_team : null

    if (leaderTeam) {
      const diffAbs = Math.abs(avgDiff).toFixed(1)
      mainInsight = `Existe consenso en una victoria de ${leaderTeam}. La mayoría espera una diferencia cercana a ${diffAbs} goles a su favor.`
    } else {
      mainInsight = `Los pronósticos están divididos entre ${selectedMatch.home_team}, ${selectedMatch.away_team} y el empate, sin una tendencia dominante clara.`
    }

    return {
      topScore, sortedScores, avgHome, avgAway, avgDiff,
      homeVotes, awayVotes, drawVotes, homePct, awayPct, drawPct,
      cleanSheetHome, cleanSheetAway, cleanSheetHomePct, cleanSheetAwayPct,
      total, exactCount, winnerCount, missCount,
      biggestHomeDiff, biggestAwayDiff, mostConservative,
      insights, mainInsight,
    }
  }, [selectedMatch, matchPredictions])

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
          <div className="analytics-banner">
            <Flag team={selectedMatch.home_team} />
            <h3 className="analytics-banner-title">
              {selectedMatch.home_team} vs {selectedMatch.away_team}
            </h3>
            <Flag team={selectedMatch.away_team} />
          </div>

          <div className="analytics-grid">
            {/* KPIs PRINCIPALES */}
            <div className="card analytics-panel">
              <h4 className="analytics-panel-title">KPIs principales</h4>
              <div className="analytics-kpi-row">
                <span className="analytics-kpi-icon">👥</span>
                <span className="analytics-kpi-text">Total participantes</span>
                <span className="analytics-kpi-num">{analysis.total}</span>
              </div>
              <div className="analytics-kpi-row">
                <span className="analytics-kpi-icon">🏆</span>
                <span className="analytics-kpi-text">Victoria {selectedMatch.home_team} pronosticada</span>
                <span className="analytics-kpi-num c-green">{analysis.homePct}%</span>
              </div>
              <div className="analytics-kpi-row">
                <span className="analytics-kpi-icon">🤝</span>
                <span className="analytics-kpi-text">Empates pronosticados</span>
                <span className="analytics-kpi-num c-amber">{analysis.drawPct}%</span>
              </div>
              <div className="analytics-kpi-row">
                <span className="analytics-kpi-icon">🛡️</span>
                <span className="analytics-kpi-text">Victoria {selectedMatch.away_team} pronosticada</span>
                <span className="analytics-kpi-num c-red">{analysis.awayPct}%</span>
              </div>
              <div className="analytics-kpi-row">
                <span className="analytics-kpi-icon">🥅</span>
                <span className="analytics-kpi-text">Arco en cero para {selectedMatch.home_team}</span>
                <span className="analytics-kpi-num c-purple">{analysis.cleanSheetHomePct}%</span>
              </div>
            </div>

            {/* MARCADOR MÁS POPULAR */}
            <div className="card analytics-panel">
              <h4 className="analytics-panel-title">Marcador más popular</h4>
              <div className="analytics-score-box">{analysis.topScore[0]}</div>
              <p className="analytics-score-sub">
                👥 {analysis.topScore[1]} participantes ({Math.round((analysis.topScore[1] / analysis.total) * 100)}%)
              </p>
              <div className="analytics-donut-wrap">
                <Doughnut
                  data={{
                    labels: analysis.sortedScores.slice(0, 4).map(([s]) => s),
                    datasets: [{
                      data: analysis.sortedScores.slice(0, 4).map(([, c]) => c),
                      backgroundColor: ['#00c853', '#3b82f6', '#f59e0b', '#a855f7'],
                      borderWidth: 0,
                    }],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                  }}
                />
              </div>
            </div>

            {/* DISTRIBUCIÓN */}
            <div className="card analytics-panel">
              <h4 className="analytics-panel-title">Distribución de pronósticos</h4>
              <table className="analytics-dist-table">
                <thead>
                  <tr><th>Marcador</th><th>Part.</th><th>%</th></tr>
                </thead>
                <tbody>
                  {analysis.sortedScores.map(([score, count]) => (
                    <tr key={score}>
                      <td><strong>{score}</strong></td>
                      <td>
                        <div className="analytics-bar-track">
                          <div
                            className="analytics-bar-fill"
                            style={{ width: `${(count / analysis.total) * 100}%` }}
                          >
                            {count}
                          </div>
                        </div>
                      </td>
                      <td>{Math.round((count / analysis.total) * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* GOLES PROMEDIO */}
          <div className="card" style={{ marginTop: '1rem' }}>
            <h4 className="analytics-panel-title">Goles promedio esperados</h4>
            <div className="analytics-goals-row">
              <div className="analytics-goals-team">
                <Flag team={selectedMatch.home_team} />
                <span>{selectedMatch.home_team}</span>
                <strong>{analysis.avgHome}</strong>
              </div>
              <span style={{ fontSize: '1.5rem' }}>⚽</span>
              <div className="analytics-goals-team">
                <Flag team={selectedMatch.away_team} />
                <span>{selectedMatch.away_team}</span>
                <strong>{analysis.avgAway}</strong>
              </div>
            </div>
            <div className="analytics-diff-box">
              Diferencia promedio esperada:{' '}
              <strong style={{ color: 'var(--gold)' }}>
                {analysis.avgDiff >= 0 ? '+' : ''}{analysis.avgDiff.toFixed(2)} goles
                {analysis.avgDiff >= 0 ? ` para ${selectedMatch.home_team}` : ` para ${selectedMatch.away_team}`}
              </strong>
            </div>
          </div>

          {/* INSIGHTS */}
          <div className="card" style={{ marginTop: '1rem' }}>
            <h4 className="analytics-panel-title">💡 Insights relevantes</h4>
            {analysis.insights.map((ins, i) => (
              <div key={i} className="analytics-insight">
                <span className="analytics-insight-icon">{ins.icon}</span>
                <div>
                  <strong>{ins.title}</strong>
                  <p>{ins.text}</p>
                </div>
              </div>
            ))}
          </div>

          {/* RANKING EXTREMOS */}
          <div className="analytics-grid" style={{ marginTop: '1rem' }}>
            <div className="card analytics-panel">
              <h4 className="analytics-panel-title">🏆 Mayor diferencia esperada</h4>
              {analysis.biggestHomeDiff.map(p => (
                <div key={p.id} className="analytics-rank-row">
                  <span>{p.username}</span>
                  <span className="badge badge-finalizado">{p.home_score}-{p.away_score}</span>
                </div>
              ))}
            </div>
            <div className="card analytics-panel">
              <h4 className="analytics-panel-title">🛡️ Predicción más conservadora</h4>
              {analysis.mostConservative.map(p => (
                <div key={p.id} className="analytics-rank-row">
                  <span>{p.username}</span>
                  <span className="badge badge-pendiente">{p.home_score}-{p.away_score}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ACIERTOS (si finalizó) */}
          {selectedMatch.is_finished && (
            <div className="card" style={{ marginTop: '1rem' }}>
              <h4 className="analytics-panel-title">
                Resultado real: {selectedMatch.home_score}-{selectedMatch.away_score} — Nivel de acierto
              </h4>
              <div className="analytics-accuracy-row">
                <div><strong className="c-amber">{analysis.exactCount}</strong><span>Exacto</span></div>
                <div><strong className="c-green">{analysis.winnerCount}</strong><span>Ganador</span></div>
                <div><strong className="c-red">{analysis.missCount}</strong><span>Falló</span></div>
              </div>
            </div>
          )}

          {/* INSIGHT PRINCIPAL */}
          <div className="analytics-main-insight">
            <span style={{ fontSize: '1.5rem' }}>⭐</span>
            <span><strong>Insight principal:</strong> {analysis.mainInsight}</span>
          </div>
        </>
      )}
    </div>
  )
}