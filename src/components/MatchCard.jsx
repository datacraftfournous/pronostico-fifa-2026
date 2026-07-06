import { useState } from 'react'
import {
  canEditAnyPrediction,
  formatKickoffColombia,
  getMatchStatus,
  statusLabel,
  maxPuntosFor,
  isKnockoutMatch,
} from '../lib/scoring'

const FLAGS = {
  Argentina: 'ar',
  Australia: 'au',
  Bélgica: 'be',
  Bolivia: 'bo',
  Brasil: 'br',
  Canadá: 'ca',
  Chile: 'cl',
  Colombia: 'co',
  'Costa de Marfil': 'ci',
  Curazao: 'cw',
  'Cabo Verde': 'cv',
  Catar: 'qa',
  Haití: 'ht',
  Jordania: 'jo',
  'Nueva Zelanda': 'nz',
  Uzbekistán: 'uz',
  Sudáfrica: 'za',
  Argelia: 'dz',
  Corea: 'kr',
  'Costa Rica': 'cr',
  Croacia: 'hr',
  Dinamarca: 'dk',
  Ecuador: 'ec',
  Egipto: 'eg',
  España: 'es',
  'Estados Unidos': 'us',
  Francia: 'fr',
  Gales: 'gb-wls',
  Alemania: 'de',
  Ghana: 'gh',
  Inglaterra: 'gb-eng',
  Irán: 'ir',
  Italia: 'it',
  Japón: 'jp',
  Marruecos: 'ma',
  México: 'mx',
  Nigeria: 'ng',
  Noruega: 'no',
  'Países Bajos': 'nl',
  Panamá: 'pa',
  Paraguay: 'py',
  Perú: 'pe',
  Polonia: 'pl',
  Portugal: 'pt',
  Senegal: 'sn',
  Serbia: 'rs',
  Suiza: 'ch',
  Túnez: 'tn',
  Uruguay: 'uy',
}
function TeamFlag({ team }) {
  const code = FLAGS[team]

  // Si no tenemos el código del país, mostramos un placeholder en vez de
  // un ícono de imagen rota.
  if (!code) {
    return (
      <div className="team-flag team-flag-fallback" aria-label={team} title={team}>
        🏳️
      </div>
    )
  }

  return (
    <img
      className="team-flag"
      src={`https://flagcdn.com/w80/${code}.png`}
      alt={team}
      // Si la URL falla (código incorrecto, CDN caído, etc.) mostramos el
      // mismo placeholder en lugar del ícono de imagen rota del navegador.
      onError={(e) => {
        e.currentTarget.replaceWith(
          Object.assign(document.createElement('div'), {
            className: 'team-flag team-flag-fallback',
            title: team,
            textContent: '🏳️',
          })
        )
      }}
    />
  )
}

export default function MatchCard({
  match,
  prediction,
  onSave,
  showPoints = false,
  readOnly = false,
  // true si el usuario ya usó su comodín en OTRO partido (no este).
  // Sirve para deshabilitar el checkbox aquí y explicarle por qué.
  jokerLockedElsewhere = false,
}) {
  const [home, setHome] = useState(prediction?.home_score ?? '')
  const [away, setAway] = useState(prediction?.away_score ?? '')
  const [advancer, setAdvancer] = useState(prediction?.predicted_advancer ?? '')
  const [joker, setJoker] = useState(prediction?.joker === true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

  const editable = !readOnly && canEditAnyPrediction(match)
  const status = getMatchStatus(match)
  const maxPuntos = maxPuntosFor(match)

  // El comodín solo existe en fase eliminatoria (así está definido en scoring.js).
  const jokerAplica = isKnockoutMatch(match)

  const isKnockout = isKnockoutMatch(match)

  async function handleSave() {
    if (home === '' || away === '') return

    // En toda eliminatoria debe quedar guardado el clasificado
    if (isKnockout && !advancer) {
      setSaveError('Debes seleccionar el equipo que clasifica')
      return
    }

    setSaving(true)
    setSaveError('')

    const result = await onSave(
      match.id,
      parseInt(home, 10),
      parseInt(away, 10),
      advancer,
      joker
    )

    setSaving(false)

    if (result === undefined) return

    if (result.success) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } else if (result.reason === 'joker_already_used') {
      // La base de datos rechazó el comodín porque ya está usado en otro
      // partido (por ejemplo, si lo guardaste desde otro dispositivo).
      // Revertimos el checkbox para que la pantalla quede consistente.
      setJoker(false)
      setSaveError('Ya usaste tu comodín en otro partido. Solo se puede usar una vez.')
      setTimeout(() => setSaveError(''), 8000)
    } else {
      const detalle = result.error?.message || result.reason || 'sin detalle'
      setSaveError(`No se pudo guardar (${detalle})`)
      setTimeout(() => setSaveError(''), 8000)
    }
  }

  return (
    <div className="card match-card">
      <div className="match-header">
        <span className="match-stage">{match.stage}</span>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span className="match-date">🇨🇴 {formatKickoffColombia(match)}</span>
          <span className={`badge badge-${status}`}>{statusLabel(status)}</span>
        </div>
      </div>

      <div className="match-teams">
        <div className="team">
          <TeamFlag team={match.home_team} />
          <div className="team-name">{match.home_team}</div>
        </div>

        <div className="score-inputs">
          <input
            type="number"
            min="0"
            max="20"
            value={home}
            onChange={(e) => setHome(e.target.value)}
            disabled={!editable}
            placeholder="-"
          />

          <span className="score-separator">:</span>

          <input
            type="number"
            min="0"
            max="20"
            value={away}
            onChange={(e) => setAway(e.target.value)}
            disabled={!editable}
            placeholder="-"
          />
        </div>

        <div className="team">
          <TeamFlag team={match.away_team} />
          <div className="team-name">{match.away_team}</div>
        </div>
      </div>

      {editable && isKnockoutMatch(match) && (
        <div className="form-group advancer-group">
          <label>Equipo que clasifica</label>
          <select
            value={advancer}
            onChange={(e) => setAdvancer(e.target.value)}
            disabled={!editable}
          >
            <option value="">Selecciona clasificado</option>
            <option value={match.home_team}>{match.home_team}</option>
            <option value={match.away_team}>{match.away_team}</option>
          </select>
        </div>
      )}

      {editable && jokerAplica && (
        <div
          style={{
            marginTop: '0.6rem',
            padding: '0.5rem 0.7rem',
            borderRadius: '8px',
            background: joker ? 'rgba(255, 200, 0, 0.12)' : 'transparent',
            border: joker ? '1px solid var(--gold, #ffc800)' : '1px solid var(--border-color, #333)',
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: jokerLockedElsewhere ? 'not-allowed' : 'pointer',
              opacity: jokerLockedElsewhere ? 0.5 : 1,
              margin: 0,
            }}
          >
            <input
              type="checkbox"
              checked={joker}
              disabled={jokerLockedElsewhere}
              onChange={(e) => setJoker(e.target.checked)}
            />
            <span>🃏 Usar mi comodín en este partido (duplica los puntos)</span>
          </label>

          {jokerLockedElsewhere && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #888)', marginTop: '0.3rem' }}>
              Ya usaste tu comodín en otro partido. Solo puedes tenerlo activo en uno.
            </div>
          )}

          {!jokerLockedElsewhere && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #888)', marginTop: '0.3rem' }}>
              Solo puedes usarlo una vez en toda la eliminatoria. Vale más cuanto más avanza el torneo.
            </div>
          )}
        </div>
      )}

      {match.is_finished && (
        <div className="match-result">
          Resultado real:{' '}
          <strong>
            {match.home_score} - {match.away_score}
          </strong>
        </div>
      )}

      {showPoints && prediction && match.is_finished && (
        <div className="match-points">
          Puntos obtenidos: <span>{prediction.points ?? 0}</span> / {maxPuntos}
          {prediction.joker && <span> · 🃏 comodín aplicado</span>}
        </div>
      )}

      {editable && (
        <div className="match-actions">
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || home === '' || away === ''}
          >
            {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar pronóstico'}
          </button>

          {saveError && (
            <div
              style={{
                color: 'var(--red, #e05a5a)',
                fontSize: '0.8rem',
                marginTop: '0.4rem',
              }}
            >
              ⚠️ {saveError}
            </div>
          )}
        </div>
      )}

      {!editable && !match.is_finished && (
        <div className="match-result">
          🔒 Partido en juego o bloqueado — no se puede editar
        </div>
      )}
    </div>
  )
}
