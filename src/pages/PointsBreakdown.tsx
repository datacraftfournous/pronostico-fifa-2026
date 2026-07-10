import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getFlagUrl } from '../lib/flags'
import {
  isKnockoutMatch,
  desglosarPuntosAny,
  formatKickoffColombia,
} from '../lib/scoring'

function Flag({ team }) {
  const url = getFlagUrl(team)
  if (!url) return null
  return <img src={url} alt={team} title={team} className="pivot-flag-img" />
}

// Fase "de exhibición" para el filtro cuando el partido no trae
// match.stage cargado: caemos a Grupos / Eliminatoria según el id,
// usando la misma regla que ya usa scoring.js (isKnockoutMatch).
function faseDeMatch(match) {
  return match.stage || (isKnockoutMatch(match) ? 'Eliminatoria' : 'Fase de grupos')
}

function fmtPts(n) {
  // Evita mostrar "1.0" para fase de grupos (siempre enteros) pero
  // conserva decimales reales de la eliminatoria (5, 3.75, etc).
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '')
}

export default function PointsBreakdown() {
  const [matches, setMatches] = useState([])
  const [predictions, setPredictions] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)

  const [stageFilter, setStageFilter] = useState('all')
  const [matchFilter, setMatchFilter] = useState('all')
  const [playerFilter, setPlayerFilter] = useState('all')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [{ data: matchData }, { data: profileData }] = await Promise.all([
        supabase.from('matches').select('*').order('kickoff_at', { ascending: true }),
        supabase.from('profiles').select('*').order('username'),
      ])

      // Paginado por si "predictions" supera el límite de 1000 filas de PostgREST.
      let allPredictions = []
      let from = 0
      const pageSize = 1000
      while (true) {
        const { data, error } = await supabase.from('predictions').select('*').range(from, from + pageSize - 1)
        if (error) throw error
        if (!data || data.length === 0) break
        allPredictions.push(...data)
        if (data.length < pageSize) break
        from += pageSize
      }

      setMatches(matchData || [])
      setProfiles(profileData || [])
      setPredictions(allPredictions)
    } finally {
      setLoading(false)
    }
  }

  // Solo partidos finalizados con marcador real cargado pueden tener
  // un desglose de puntos (mientras no hay resultado, no hay nada que calcular).
  const finishedMatches = useMemo(() => {
    return matches.filter(
      (m) => m.is_finished && m.home_score != null && m.away_score != null
    )
  }, [matches])

  const stages = useMemo(() => {
    return [...new Set(finishedMatches.map(faseDeMatch))]
  }, [finishedMatches])

  const matchesOfStage = useMemo(() => {
    if (stageFilter === 'all') return finishedMatches
    return finishedMatches.filter((m) => faseDeMatch(m) === stageFilter)
  }, [finishedMatches, stageFilter])

  useEffect(() => {
    setMatchFilter('all')
  }, [stageFilter])

  const predMap = useMemo(() => {
    const map = {}
    for (const p of predictions) {
      map[`${p.match_id}-${p.user_id}`] = p
    }
    return map
  }, [predictions])

  // Cruza jugador × partido × predicción y arma una fila con el
  // desglose completo, solo cuando existe un pronóstico con marcador.
  const rows = useMemo(() => {
    const matchesToUse =
      matchFilter === 'all' ? matchesOfStage : matchesOfStage.filter((m) => String(m.id) === String(matchFilter))

    const playersToUse =
      playerFilter === 'all' ? profiles : profiles.filter((p) => String(p.id) === String(playerFilter))

    const out = []
    for (const match of matchesToUse) {
      for (const profile of playersToUse) {
        const pred = predMap[`${match.id}-${profile.id}`]
        if (!pred || pred.home_score == null || pred.away_score == null) continue

        const desglose = desglosarPuntosAny(pred, match)
        out.push({
          key: `${match.id}-${profile.id}`,
          match,
          profile,
          pred,
          desglose,
        })
      }
    }

    // Orden: partido (cronológico) y dentro de cada uno, mayor puntaje primero.
    out.sort((a, b) => {
      const t = new Date(a.match.kickoff_at) - new Date(b.match.kickoff_at)
      if (t !== 0) return t
      return b.desglose.total - a.desglose.total
    })

    return out
  }, [matchesOfStage, matchFilter, playerFilter, profiles, predMap])

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader" />
      </div>
    )
  }

  return (
    <div>
      <h2 className="page-title">🧮 Desglose de puntos</h2>
      <p className="page-subtitle">Cómo se obtuvo el puntaje de cada jugador, pronóstico por pronóstico</p>

      {/* FILTROS */}
      <div className="card predictions-filters">
        <div>
          <label className="filter-label">Fase</label>
          <select className="date-select" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
            <option value="all">Todas las fases</option>
            {stages.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="filter-label">Partido</label>
          <select className="date-select" value={matchFilter} onChange={(e) => setMatchFilter(e.target.value)}>
            <option value="all">Todos los partidos {stageFilter === 'all' ? '' : `de ${stageFilter}`}</option>
            {matchesOfStage.map((m) => (
              <option key={m.id} value={m.id}>
                {formatKickoffColombia(m)} — {m.home_team} vs {m.away_team}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="filter-label">Jugador</label>
          <select className="date-select" value={playerFilter} onChange={(e) => setPlayerFilter(e.target.value)}>
            <option value="all">Todos los jugadores</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name || p.username}
              </option>
            ))}
          </select>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card" style={{ padding: 20, marginTop: '1rem' }}>
          No hay pronósticos con puntaje para los filtros seleccionados.
        </div>
      ) : (
        <div className="card" style={{ padding: '0.75rem', marginTop: '1rem', overflowX: 'auto' }}>
          <table className="pivot-table">
            <thead>
              <tr>
                <th>Jugador</th>
                <th>Partido</th>
                <th>Pron.</th>
                <th>Real</th>
                <th style={{ minWidth: '260px', textAlign: 'left' }}>Cómo obtuvo el puntaje</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ key, match, profile, pred, desglose }) => (
                <tr key={key}>
                  <td className="pivot-player">{profile.display_name || profile.username}</td>
                  <td>
                    <div className="pivot-match-header" style={{ justifyContent: 'flex-start', gap: '0.4rem' }}>
                      <Flag team={match.home_team} />
                      <span style={{ fontSize: '0.75rem' }}>
                        {match.home_team} vs {match.away_team}
                      </span>
                      <Flag team={match.away_team} />
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {faseDeMatch(match)} · {formatKickoffColombia(match)}
                    </div>
                  </td>
                  <td className="pivot-pred" style={{ textAlign: 'center' }}>
                    {pred.home_score}-{pred.away_score}
                  </td>
                  <td className="pivot-real" style={{ textAlign: 'center' }}>
                    {match.home_score}-{match.away_score}
                  </td>
                  <td style={{ textAlign: 'left' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                      {desglose.items.map((item, i) => (
                        <span
                          key={i}
                          style={{
                            fontSize: '0.75rem',
                            color: item.logrado ? undefined : 'var(--text-muted)',
                          }}
                        >
                          {item.logrado ? '✅' : '⬜'} {item.label}
                          {item.puntos !== 0 ? ` (+${fmtPts(item.puntos)})` : ''}
                        </span>
                      ))}

                      {desglose.bonoAvance > 0 && (
                        <span style={{ fontSize: '0.75rem' }}>
                          ✅ Acertó quién avanza de ronda (+{fmtPts(desglose.bonoAvance)})
                        </span>
                      )}

                      {isKnockoutMatch(match) && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          Subtotal {fmtPts(desglose.puntosBase)}
                          {desglose.multiplicador !== 1 && ` × multiplicador de fase (x${fmtPts(desglose.multiplicador)}) = ${fmtPts(desglose.puntosConMultiplicador)}`}
                          {desglose.esComodin && ` × comodín (x2) = ${fmtPts(desglose.total)}`}
                        </span>
                      )}

                      {desglose.esComodin && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--gold)' }}>🃏 Comodín aplicado (doble puntos)</span>
                      )}
                    </div>
                  </td>
                  <td className="pivot-points" style={{ textAlign: 'center', color: 'var(--gold)', fontWeight: 700 }}>
                    {fmtPts(desglose.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
