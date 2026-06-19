import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import MatchCard from '../components/MatchCard'

export default function Predictions() {
  const { user } = useAuth()

  const [matches, setMatches] = useState([])
  const [predictions, setPredictions] = useState({})
  const [loading, setLoading] = useState(true)

  const [statusFilter, setStatusFilter] = useState('todos')
  const [groupFilter, setGroupFilter] = useState('todos')
  const [dateFilter, setDateFilter] = useState('todas')

  function getLocalDate(dateString) {
    return new Date(dateString).toLocaleDateString(
      'en-CA',
      {
        timeZone: 'America/Bogota',
      }
    )
  }

  useEffect(() => {
    setDateFilter('todas')
  }, [groupFilter])

  useEffect(() => {
    loadData()
  }, [user])

  async function loadData() {
    if (!user) return

    setLoading(true)

    const [{ data: matchData }, { data: predData }] =
      await Promise.all([
        supabase
          .from('matches')
          .select('*')
          .order('kickoff_at', {
            ascending: true,
          }),

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

  async function handleSave(
    matchId,
    homeScore,
    awayScore
  ) {
    const existing = predictions[matchId]

    if (existing) {
      const { error } = await supabase
        .from('predictions')
        .update({
          home_score: homeScore,
          away_score: awayScore,
          updated_at:
            new Date().toISOString(),
        })
        .eq('id', existing.id)

      if (!error) {
        setPredictions((prev) => ({
          ...prev,
          [matchId]: {
            ...existing,
            home_score: homeScore,
            away_score: awayScore,
          },
        }))
      }
    } else {
      const { data, error } =
        await supabase
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
        setPredictions((prev) => ({
          ...prev,
          [matchId]: data,
        }))
      }
    }
  }

  const availableDates = useMemo(() => {
    let source = matches

    if (groupFilter !== 'todos') {
      source = source.filter(
        (m) =>
          m.group_code === groupFilter
      )
    }

    return [
      ...new Set(
        source.map((m) =>
          getLocalDate(m.kickoff_at)
        )
      ),
    ].sort()
  }, [matches, groupFilter])

  const filteredMatches = useMemo(() => {
    let result = [...matches]

    if (groupFilter !== 'todos') {
      result = result.filter(
        (m) =>
          m.group_code === groupFilter
      )
    }

    if (dateFilter !== 'todas') {
      result = result.filter(
        (m) =>
          getLocalDate(m.kickoff_at) ===
          dateFilter
      )
    }

    if (statusFilter === 'pendientes') {
      result = result.filter(
        (m) => !m.is_finished
      )
    }

    if (statusFilter === 'finalizados') {
      result = result.filter(
        (m) => m.is_finished
      )
    }

    result.sort(
      (a, b) =>
        new Date(a.kickoff_at) -
        new Date(b.kickoff_at)
    )

    return result
  }, [
    matches,
    groupFilter,
    dateFilter,
    statusFilter,
  ])

  const myTotal = Object.values(
    predictions
  ).reduce(
    (sum, p) => sum + (p.points || 0),
    0
  )

  if (loading) {
    return (
      <div
        className="loading-screen"
        style={{
          minHeight: '200px',
        }}
      >
        <div className="loader" />
      </div>
    )
  }

  return (
    <div>
      <h2 className="page-title">
        📝 Mis pronósticos
      </h2>

      <p className="page-subtitle">
        Tus puntos acumulados:{' '}
        <strong
          style={{
            color: 'var(--gold)',
          }}
        >
          {myTotal}
        </strong>
      </p>

      <div className="card predictions-filters">
        <div>
          <label className="filter-label">
            Grupo
          </label>

          <div className="group-filter">
            <button
              type="button"
              className={
                groupFilter === 'todos'
                  ? 'group-btn active'
                  : 'group-btn'
              }
              onClick={() =>
                setGroupFilter('todos')
              }
            >
              Todos
            </button>

            {'ABCDEFGHIJKL'
              .split('')
              .map((group) => (
                <button
                  key={group}
                  type="button"
                  className={
                    groupFilter === group
                      ? 'group-btn active'
                      : 'group-btn'
                  }
                  onClick={() =>
                    setGroupFilter(group)
                  }
                >
                  {group}
                </button>
              ))}
          </div>
        </div>

      <div>
  <label className="filter-label">
    Fecha
  </label>

  <div className="date-filter">
    <button
      type="button"
      className={
        dateFilter === 'todas'
          ? 'date-btn active'
          : 'date-btn'
      }
      onClick={() =>
        setDateFilter('todas')
      }
    >
      Todas
    </button>

    {availableDates.map((date) => (
      <button
        key={date}
        type="button"
        className={
          dateFilter === date
            ? 'date-btn active'
            : 'date-btn'
        }
        onClick={() =>
          setDateFilter(date)
        }
      >
        {new Date(
          date + 'T00:00:00'
        ).toLocaleDateString(
          'es-CO',
          {
            day: '2-digit',
            month: 'short',
          }
        )}
      </button>
    ))}
  </div>
</div>
      
      
      </div>

      <div className="tabs">
        {[
          ['todos', 'Todos'],
          [
            'pendientes',
            'Pendientes',
          ],
          [
            'finalizados',
            'Finalizados',
          ],
        ].map(([key, label]) => (
          <button
            key={key}
            className={`tab${
              statusFilter === key
                ? ' active'
                : ''
            }`}
            onClick={() =>
              setStatusFilter(key)
            }
          >
            {label}
          </button>
        ))}
      </div>

      {filteredMatches.length === 0 ? (
        <div className="empty-state card">
          <div className="icon">
            📅
          </div>
          <p>
            No hay partidos para
            los filtros
            seleccionados.
          </p>
        </div>
      ) : (
        filteredMatches.map(
          (match) => (
            <MatchCard
              key={match.id}
              match={match}
              prediction={
                predictions[match.id]
              }
              onSave={handleSave}
              showPoints
            />
          )
        )
      )}
    </div>
  )
}