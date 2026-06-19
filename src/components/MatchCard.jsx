import { useState } from 'react'
import {
  formatKickoffColombia,
  getMatchStatus,
  statusLabel
} from '../lib/scoring'

export default function MatchCard({
  match,
  prediction,
  onSave,
  showPoints = false,
  readOnly = false
}) {
  const [home, setHome] = useState(prediction?.home_score ?? '')
  const [away, setAway] = useState(prediction?.away_score ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // 🔒 BLOQUEO ABSOLUTO (ya no depende de reglas externas)
  const editable = !readOnly && !match.is_finished

  const status = getMatchStatus(match)

  async function handleSave() {
    if (!editable) return
    if (home === '' || away === '') return

    setSaving(true)

    await onSave(
      match.id,
      parseInt(home, 10),
      parseInt(away, 10)
    )

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="card match-card">
      <div className="match-header">
        <span className="match-stage">{match.stage}</span>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span className="match-date">
            🇨🇴 {formatKickoffColombia(match)}
          </span>

          <span className={`badge badge-${status}`}>
            {statusLabel(status)}
          </span>
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
          Resultado real:{' '}
          <strong>
            {match.home_score} - {match.away_score}
          </strong>
        </div>
      )}

      {showPoints && prediction && match.is_finished && (
        <div className="match-points">
          Puntos obtenidos:{' '}
          <span>{prediction.points ?? 0}</span> / 5
        </div>
      )}

      {/* 🔒 SOLO SE MUESTRA SI ES EDITABLE */}
      {editable && (
        <div className="match-actions">
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={
              saving ||
              home === '' ||
              away === ''
            }
          >
            {saving
              ? 'Guardando...'
              : saved
              ? '✓ Guardado'
              : 'Guardar pronóstico'}
          </button>
        </div>
      )}

      {/* 🔒 MENSAJE CLARO CUANDO ESTÁ BLOQUEADO */}
      {!editable && (
        <div className="match-result">
          🔒 Pronóstico bloqueado
        </div>
      )}
    </div>
  )
}