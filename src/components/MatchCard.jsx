import { useState } from 'react'
import {
  canEditAnyPrediction,
  formatKickoffColombia,
  getMatchStatus,
  statusLabel,
  maxPuntosFor,
} from '../lib/scoring'

export default function MatchCard({
  match,
  prediction,
  onSave,
  showPoints = false,
  readOnly = false,
}) {
  const [home, setHome] = useState(prediction?.home_score ?? '')
  const [away, setAway] = useState(prediction?.away_score ?? '')
  const [advancer, setAdvancer] = useState(prediction?.predicted_advancer ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

  const editable = !readOnly && canEditAnyPrediction(match)
  const status = getMatchStatus(match)
  const maxPuntos = maxPuntosFor(match)

  const isKnockout =
    canEditAnyPrediction(match) &&
    home !== '' &&
    away !== '' &&
    Number(home) === Number(away)

  async function handleSave() {
    if (home === '' || away === '') return

    // validación: si empate en eliminatoria exigir clasificado
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
      advancer
    )

    setSaving(false)

    if (result === undefined) return

    if (result.success) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
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
        <div className="team-name">{match.home_team}</div>

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

        {editable && isKnockout && (
          <div className="form-group" style={{ marginTop: '0.5rem' }}>
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

        <div className="team-name">{match.away_team}</div>
      </div>

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