import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getFlagUrl } from '../lib/flags'

function getLocalDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
}

function todayInColombia() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
}

function formatHora(iso) {
  return new Date(iso).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Bogota',
  })
}

function FlagImg({ team }) {
  const url = getFlagUrl(team)
  if (!url) return null
  return <img src={url} alt={team} className="today-flag" />
}

// Franja fija debajo del header, visible en toda la app.
// Muestra: partido(s) en vivo primero, luego los ya jugados HOY
// (el más reciente primero), y por último los que faltan por jugar hoy.
// Se refresca sola cada 45s para reflejar resultados nuevos sin
// que el usuario tenga que recargar la página.
export default function TodayMatchesStrip() {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)

  const loadMatches = useCallback(async () => {
    const today = todayInColombia()

    const { data, error } = await supabase
      .from('matches')
      .select('id, home_team, away_team, home_score, away_score, status, is_finished, kickoff_at')
      .order('kickoff_at', { ascending: true })

    if (error) {
      console.error('Error cargando partidos del día:', error.message)
      return
    }

    const deHoy = (data || []).filter((m) => getLocalDate(m.kickoff_at) === today)
    setMatches(deHoy)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadMatches()
    const interval = setInterval(loadMatches, 45000)
    return () => clearInterval(interval)
  }, [loadMatches])

  if (loading || matches.length === 0) return null

  const enVivo = matches.filter((m) => m.status === 'en_juego')
  const finalizados = [...matches.filter((m) => m.is_finished)].reverse()
  const pendientes = matches.filter((m) => !m.is_finished && m.status !== 'en_juego')

  const ordenados = [...enVivo, ...finalizados, ...pendientes]

  return (
    <div className="today-strip">
      <div className="today-strip-inner">
        {ordenados.map((m) => {
          const esVivo = m.status === 'en_juego'
          return (
            <div key={m.id} className={`today-match-card${esVivo ? ' live' : ''}`}>
              <div className="today-match-status">
                {esVivo ? (
                  <span className="live-dot">● EN VIVO</span>
                ) : m.is_finished ? (
                  <span className="ft-tag">FINALIZADO</span>
                ) : (
                  <span className="upcoming-tag">{formatHora(m.kickoff_at)}</span>
                )}
              </div>

              <div className="today-match-teams">
                <div className="today-team">
                  <FlagImg team={m.home_team} />
                  <span>{m.home_team}</span>
                </div>

                <div className="today-score">
                  {m.is_finished || esVivo ? `${m.home_score ?? 0} - ${m.away_score ?? 0}` : 'vs'}
                </div>

                <div className="today-team">
                  <FlagImg team={m.away_team} />
                  <span>{m.away_team}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}