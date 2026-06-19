import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import MatchCard from '../components/MatchCard'

export default function PublicPredictions() {
  const [matches, setMatches] = useState([])
  const [predictions, setPredictions] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)

    const [{ data: matchData }, { data: predData }] = await Promise.all([
      supabase.from('matches').select('*').order('kickoff_at'),
      supabase.from('predictions').select('*')
    ])

    setMatches(matchData || [])

    const map = {}
    for (const p of predData || []) {
      if (!map[p.match_id]) map[p.match_id] = []
      map[p.match_id].push(p)
    }

    setPredictions(map)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader" />
      </div>
    )
  }

  return (
    <div>
      <h2 className="page-title">👀 Pronósticos públicos</h2>

      {matches.map(match => (
        <MatchCard
          key={match.id}
          match={match}
          prediction={predictions[match.id]}
          readOnly
        />
      ))}
    </div>
  )
}