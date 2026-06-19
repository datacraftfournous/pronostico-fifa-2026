import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import MatchCard from '../components/MatchCard'

export default function Predictions() {
  const { user } = useAuth()
  const [matches, setMatches] = useState([])
  const [predictions, setPredictions] = useState({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('todos')

  useEffect(() => {
    loadData()
  }, [user])

  async function loadData() {
    if (!user) return
    setLoading(true)

    const [{ data: matchData }, { data: predData }] = await Promise.all([
      supabase.from('matches').select('*').order('kickoff_at'),
      supabase.from('predictions').select('*').eq('user_id', user.id),
    ])

    setMatches(matchData || [])
    const predMap = {}
    for (const p of predData || []) {
      predMap[p.match_id] = p
    }
    setPredictions(predMap)
    setLoading(false)
  }

  async function handleSave(matchId, homeScore, awayScore) {
    const existing = predictions[matchId]

    if (existing) {
      const { error } = await supabase
        .from('predictions')
        .update({ home_score: homeScore, away_score: awayScore, updated_at: new Date().toISOString() })
        .eq('id', existing.id)

      if (!error) {
        setPredictions((prev) => ({
          ...prev,
          [matchId]: { ...existing, home_score: homeScore, away_score: awayScore },
        }))
      }
    } else {
      const { data, error } = await supabase
        .from('predictions')
        .insert({
          user_id: user.id,
          match_id: matchId,
          home_score: homeScore,
          away_score: awayScore,
        })
        .select()
        .single()

      if (!error && data) {
        setPredictions((prev) => ({ ...prev, [matchId]: data }))
      }
    }
  }

  const filtered = matches.filter((m) => {
    if (filter === 'pendientes') return !m.is_finished
    if (filter === 'finalizados') return m.is_finished
    return true
  })

  const myTotal = Object.values(predictions).reduce((sum, p) => sum + (p.points || 0), 0)

  if (loading) {
    return (
      <div className="loading-screen" style={{ minHeight: '200px' }}>
        <div className="loader" />
      </div>
    )
  }

  return (
    <div>
      <h2 className="page-title">📝 Mis pronósticos</h2>
      <p className="page-subtitle">
        Tus puntos acumulados: <strong style={{ color: 'var(--gold)' }}>{myTotal}</strong>
      </p>

      <div className="tabs">
        {[
          ['todos', 'Todos'],
          ['pendientes', 'Pendientes'],
          ['finalizados', 'Finalizados'],
        ].map(([key, label]) => (
          <button
            key={key}
            className={`tab${filter === key ? ' active' : ''}`}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state card">
          <div className="icon">📅</div>
          <p>No hay partidos en esta categoría.</p>
        </div>
      ) : (
        filtered.map((match) => (
          <MatchCard
            key={match.id}
            match={match}
            prediction={predictions[match.id]}
            onSave={handleSave}
            showPoints
          />
        ))
      )}
    </div>
  )
}
