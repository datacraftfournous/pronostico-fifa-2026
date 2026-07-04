import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import MatchCard from '../components/MatchCard'
import {
  isKnockoutMatch,
  canEditSpecialPrediction,
  PUNTOS_CAMPEON,
  PUNTOS_GOLEADOR,
  SPECIAL_PREDICTIONS_DEADLINE,
} from '../lib/scoring'

export default function Predictions() {
  const { user } = useAuth()

  const [matches, setMatches] = useState([])
  const [predictions, setPredictions] = useState({})
  const [loading, setLoading] = useState(true)

  // Submenú principal de la página: partidos normales vs. campeón/goleador
  const [mainTab, setMainTab] = useState('partidos') // 'partidos' | 'especiales'

  // Predicción especial (campeón + goleador)
  const [specialPrediction, setSpecialPrediction] = useState(null)
  const [championPick, setChampionPick] = useState('')
  const [topScorerPick, setTopScorerPick] = useState('')
  const [specialSaving, setSpecialSaving] = useState(false)
  const [specialMessage, setSpecialMessage] = useState('')
  const [specialError, setSpecialError] = useState('')

  const [statusFilter, setStatusFilter] = useState('todos')
  const [groupFilter, setGroupFilter] = useState('todos')
  const [dateFilter, setDateFilter] = useState('todas')
  const [stageFilter, setStageFilter] = useState('eliminatoria') // 'grupos' | 'eliminatoria'

  // Acceso rápido: Fase (match.stage real, igual que en Admin) -> Partido
  const [quickStage, setQuickStage] = useState('')
  const [quickMatchId, setQuickMatchId] = useState('')

  function getLocalDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-CA', {
      timeZone: 'America/Bogota',
    })
  }

  useEffect(() => {
    setDateFilter('todas')
  }, [groupFilter, stageFilter, quickStage])

  useEffect(() => {
    loadData()
    loadSpecialPrediction()
  }, [user])

  async function loadSpecialPrediction() {
    if (!user) return

    const { data, error } = await supabase
      .from('special_predictions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      console.error('Error cargando predicción especial', error)
      return
    }

    setSpecialPrediction(data || null)
    setChampionPick(data?.predicted_champion || '')
    setTopScorerPick(data?.predicted_top_scorer || '')
  }

  async function handleSaveSpecial(e) {
    e.preventDefault()
    setSpecialError('')
    setSpecialMessage('')

    if (!canEditSpecialPrediction()) {
      setSpecialError('El plazo para elegir campeón y goleador ya venció.')
      return
    }

    if (!championPick || !topScorerPick.trim()) {
      setSpecialError('Elige un campeón y escribe un goleador.')
      return
    }

    setSpecialSaving(true)

    // La tabla special_predictions no tiene columna "id" propia: user_id
    // es la llave (una fila por usuario), así que usamos upsert en vez de
    // decidir a mano entre insert/update.
    const { data, error } = await supabase
      .from('special_predictions')
      .upsert(
        {
          user_id: user.id,
          predicted_champion: championPick,
          predicted_top_scorer: topScorerPick.trim(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single()

    setSpecialSaving(false)

    if (error || !data) {
      console.error('Error guardando predicción especial', error)
      setSpecialError('Error guardando tu predicción. Intenta de nuevo.')
      return
    }

    setSpecialPrediction(data)
    setSpecialMessage('¡Predicción guardada!')
  }

  // Equipos disponibles para elegir campeón (derivados de los partidos ya cargados).
  const teams = useMemo(() => {
    const set = new Set()
    matches.forEach((m) => {
      if (m.home_team) set.add(m.home_team)
      if (m.away_team) set.add(m.away_team)
    })
    return [...set].sort()
  }, [matches])

  const specialDeadlineLabel = new Date(SPECIAL_PREDICTIONS_DEADLINE).toLocaleDateString(
    'es-CO',
    { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' }
  )

  const specialEditable = canEditSpecialPrediction()

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
  async function handleSave(matchId, homeScore, awayScore, predictedAdvancer) {
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
          predicted_advancer: predictedAdvancer,
        })
        .eq('id', existing.id)

      if (error) {
        console.error('Error actualizando predicción', error)
        return { success: false, reason: 'supabase_error', error }
      }

      setPredictions((prev) => ({
        ...prev,
        [realMatchId]: {
          ...existing,
          home_score: homeScore,
          away_score: awayScore,
          predicted_advancer: predictedAdvancer,
        },
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
          predicted_advancer: predictedAdvancer,
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

  // Fases reales tal como están guardadas en match.stage (ej: "Grupo A",
  // "Octavos", "Semifinal"...), igual que el combo "Fase" del Admin.
  const availableStages = useMemo(() => {
    return [...new Set(matches.map((m) => m.stage))].sort()
  }, [matches])

  // Partidos de la fase elegida en el acceso rápido, ordenados por fecha.
  const quickStageMatches = useMemo(() => {
    return matches
      .filter((m) => m.stage === quickStage)
      .sort((a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at))
  }, [matches, quickStage])

  const stageMatches = useMemo(() => {
    return matches.filter((m) =>
      stageFilter === 'eliminatoria' ? isKnockoutMatch(m) : !isKnockoutMatch(m)
    )
  }, [matches, stageFilter])

  // Partidos base: si hay una Fase elegida en el acceso rápido, esa manda
  // (ignora los tabs de eliminatoria/grupos y el filtro de grupo, porque la
  // fase real ya es más específica). Si no, se usa el filtro de siempre.
  const baseMatches = useMemo(() => {
    if (quickStage) {
      return matches.filter((m) => m.stage === quickStage)
    }

    let result = stageMatches

    if (stageFilter === 'grupos' && groupFilter !== 'todos') {
      result = result.filter((m) => m.group_code === groupFilter)
    }

    return result
  }, [matches, quickStage, stageMatches, stageFilter, groupFilter])

  const availableDates = useMemo(() => {
    return [...new Set(baseMatches.map((m) => getLocalDate(m.kickoff_at)))].sort()
  }, [baseMatches])

  const filteredMatches = useMemo(() => {
    let result = [...baseMatches]

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
  }, [baseMatches, dateFilter, statusFilter])

  // Si el usuario eligió un partido puntual con el combo Fase/Partido,
  // mostramos solo ese, ignorando el resto de los filtros de abajo.
  const displayedMatches = quickMatchId
    ? matches.filter((m) => String(m.id) === String(quickMatchId))
    : filteredMatches

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

      {/* SUBMENÚ PRINCIPAL */}
      <div className="tabs" style={{ marginBottom: '0.75rem' }}>
        {[
          ['partidos', '⚽ Partidos'],
          ['especiales', '🏆 Campeón y goleador'],
        ].map(([key, label]) => (
          <button
            key={key}
            className={`tab${mainTab === key ? ' active' : ''}`}
            onClick={() => setMainTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {mainTab === 'especiales' ? (
        <div className="admin-section card">
          <h2>🏆 Campeón y goleador del torneo</h2>
          <p className="page-subtitle">
            Vale {PUNTOS_CAMPEON} puntos acertar el campeón y {PUNTOS_GOLEADOR} puntos
            acertar el goleador. Puedes cambiar tu elección hasta el{' '}
            <strong>{specialDeadlineLabel}</strong>.
          </p>

          {!specialEditable && (
            <div className="error-msg" style={{ marginBottom: '1rem' }}>
              El plazo para elegir campeón y goleador ya venció. Ya no se puede editar.
            </div>
          )}

          {specialMessage && <div className="success-msg">{specialMessage}</div>}
          {specialError && <div className="error-msg">{specialError}</div>}

          <form onSubmit={handleSaveSpecial}>
            <div className="form-group">
              <label>Campeón</label>
              <select
                value={championPick}
                onChange={(e) => setChampionPick(e.target.value)}
                disabled={!specialEditable}
                required
              >
                <option value="">Selecciona un equipo</option>
                {teams.map((team) => (
                  <option key={team} value={team}>
                    {team}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Goleador</label>
              <input
                type="text"
                value={topScorerPick}
                onChange={(e) => setTopScorerPick(e.target.value)}
                disabled={!specialEditable}
                placeholder="Nombre del jugador"
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-gold"
              disabled={!specialEditable || specialSaving}
            >
              {specialSaving ? 'Guardando...' : 'Guardar predicción'}
            </button>
          </form>
        </div>
      ) : (
        <>
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

          {/* ACCESO RÁPIDO: Fase -> Partido (igual que en Admin) */}
          <div className="admin-section card" style={{ marginBottom: '0.75rem' }}>
            <div className="form-group">
              <label>Fase</label>
              <select
                value={quickStage}
                onChange={(e) => {
                  setQuickStage(e.target.value)
                  setQuickMatchId('')
                }}
              >
                <option value="">Selecciona una fase</option>
                {availableStages.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Partido</label>
              <select
                value={quickMatchId}
                onChange={(e) => setQuickMatchId(e.target.value)}
                disabled={!quickStage}
              >
                <option value="">Selecciona un partido</option>
                {quickStageMatches.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.home_team} vs {m.away_team} —{' '}
                    {new Date(m.kickoff_at).toLocaleDateString('es-CO', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </option>
                ))}
              </select>
            </div>

            {quickMatchId && (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setQuickStage('')
                  setQuickMatchId('')
                }}
              >
                Ver todos los partidos de nuevo
              </button>
            )}
          </div>

          {/* FILTROS */}
          <div className="card predictions-filters">
            {stageFilter === 'grupos' && !quickStage && (
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
          {displayedMatches.length === 0 ? (
            <div className="empty-state card">
              <div className="icon">📅</div>
              <p>No hay partidos para los filtros seleccionados.</p>
            </div>
          ) : (
            displayedMatches.map((match) => (
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
        </>
      )}
    </div>
  )
}
