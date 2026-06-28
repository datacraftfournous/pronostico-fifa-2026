import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import MatchCard from '../components/MatchCard'
import { isKnockoutMatch } from '../lib/scoring'

export default function Predictions() {
  const { user } = useAuth()

  const [matches, setMatches] = useState([])
  const [predictions, setPredictions] = useState({})
  const [loading, setLoading] = useState(true)

  const [statusFilter, setStatusFilter] = useState('todos')
  const [groupFilter, setGroupFilter] = useState('todos')
  const [dateFilter, setDateFilter] = useState('todas')
  const [stageFilter, setStageFilter] = useState('eliminatoria') // 'grupos' | 'eliminatoria'

  function getLocalDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-CA', {
      timeZone: 'America/Bogota',
    })
  }

  useEffect(() => {
    setDateFilter('todas')
  }, [groupFilter, stageFilter])

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

  // Guardado habilitado SOLO para partidos de eliminatoria (id > 72).
  // Fase de grupos sigue bloqueada por completo (ya cerrada).
  // IMPORTANTE: comparamos con String() (no ===) porque matchId puede
  // llegar como string desde el input/evento, mientras match.id es number.
  async function handleSave(matchId, homeScore, awayScore) {
    const match = matches.find((m) => String(m.id) === String(matchId))

    if (!match) {
      console.error('No se encontró el partido', matchId)
      return { success: false, reason: 'match_not_found' }
    }

    if (!isKnockoutMatch(match)) {
      console.error('Partido de fase de grupos, edición bloqueada', matchId)
      return { success: false, reason: 'group_stage_locked' }
    }

    // Usamos el id real (number) del match encontrado para todo lo demás,
    // así evitamos cualquier desajuste de tipos en las claves del objeto predictions.
    const realMatchId = match.id
    const existing = predictions[realMatchId]

    if (existing) {
      const { error } = await supabase
        .from('predictions')
        .update({
          home_score: homeScore,
          away_score: awayScore,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)

      if (error) {
        console.error('Error actualizando predicción', error)
        return { success: false, reason: 'supabase_error', error }
      }

      setPredictions((prev) => ({
        ...prev,
        [realMatchId]: { ...existing, home_score: homeScore, away_score: awayScore },
      }))
      return { success: true }
    } else {
      const { data, error } = await supabase
        .from('predictions')
        .insert({
          user_id: user.id,
          match_id: realMatchId,
          home_score: homeScore,
          away_score: awayScore,
        })
        .select()
        .single()

      if (error || !data) {
        console.error('Error insertando predicción', error)
        return { success: false, reason: 'supabase_error', error }
      }

      setPredictions((prev) => ({ ...prev, [realMatchId]: data }))
      return { success: true }
    }
  }

  const stageMatches = useMemo(() => {
    return matches.filter((m) =>
      stageFilter === 'eliminatoria' ? isKnockoutMatch(m) : !isKnockoutMatch(m)
    )
  }, [matches, stageFilter])

  const availableDates = useMemo(() => {
    let source = stageMatches

    if (groupFilter !== 'todos') {
      source = source.filter((m) => m.group_code === groupFilter)
    }

    return [...new Set(source.map((m) => getLocalDate(m.kickoff_at)))].sort()
  }, [stageMatches, groupFilter])

  const filteredMatches = useMemo(() => {
    let result = [...stageMatches]

    if (stageFilter === 'grupos' && groupFilter !== 'todos') {
      result = result.filter((m) => m.group_code === groupFilter)
    }

    if (dateFilter !== 'todas') {
      result = result.filter((m) => getLocalDate(m.kickoff_at) === dateFilter)
    }

    if (statusFilter === 'pendientes') {
      result = result.filter((m) => !m.is_finished)
    }

    if (statusFilter === 'finalizados') {
      result = result.filter((m) => m.is_finished)
    }

    result.sort((a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at))

    return result
  }, [stageMatches, groupFilter, dateFilter, statusFilter, stageFilter])

  const myTotal = Object.values(predictions).reduce(
    (sum, p) => sum + (p.points || 0),
    0
  )

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
        Tus puntos acumulados:{' '}
        <strong style={{ color: 'var(--gold)' }}>{myTotal}</strong>
      </p>

      {/* FASE: grupos (solo lectura) vs eliminatoria (editable) */}
      <div className="tabs" style={{ marginBottom: '0.75rem' }}>
        {[
          ['eliminatoria', '🏆 Dieciseisavos en adelante'],
          ['grupos', '📅 Fase de grupos (cerrada)'],
        ].map(([key, label]) => (
          <button
            key={key}
            className={`tab${stageFilter === key ? ' active' : ''}`}
            onClick={() => setStageFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* FILTROS */}
      <div className="card predictions-filters">
        {stageFilter === 'grupos' && (
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

              {'ABCDEFGHIJKL'.split('').map((group) => (
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
        )}

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

            {availableDates.map((date) => (
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

      {/* TABS de estado */}
      <div className="tabs">
        {[
          ['todos', 'Todos'],
          ['pendientes', 'Pendientes'],
          ['finalizados', 'Finalizados'],
        ].map(([key, label]) => (
          <button
            key={key}
            className={`tab${statusFilter === key ? ' active' : ''}`}
            onClick={() => setStatusFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* MATCHES */}
      {filteredMatches.length === 0 ? (
        <div className="empty-state card">
          <div className="icon">📅</div>
          <p>No hay partidos para los filtros seleccionados.</p>
        </div>
      ) : (
        filteredMatches.map((match) => (
          <MatchCard
            key={match.id}
            match={match}
            prediction={predictions[match.id]}
            onSave={handleSave}
            showPoints
            readOnly={!isKnockoutMatch(match)}
          />
        ))
      )}
    </div>
  )
}
