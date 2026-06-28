import { useState } from 'react'
import {
  canEditAnyPrediction,
  formatKickoffColombia,
  getMatchStatus,
  statusLabel,
  maxPuntosFor,
} from '../lib/scoring'

export default function MatchCard({ match, prediction, onSave, showPoints = false, readOnly = false }) {
  const [home, setHome] = useState(prediction?.home_score ?? '')
  const [away, setAway] = useState(prediction?.away_score ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const editable = !readOnly && canEditAnyPrediction(match)
  const status = getMatchStatus(match)
  const maxPuntos = maxPuntosFor(match)

  async function handleSave() {
    if (home === '' || away === '') return
    setSaving(true)
    await onSave(match.id, parseInt(home, 10), parseInt(away, 10))
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
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

        <div className="team-name">{match.away_team}</div>
      </div>

      {match.is_finished && (
        <div className="match-result">
          Resultado real: <strong>{match.home_score} - {match.away_score}</strong>
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
        </div>
      )}

      {!editable && !match.is_finished && (
        <div className="match-result">🔒 Partido en juego o bloqueado — no se puede editar</div>
      )}
    </div>
  )
}
