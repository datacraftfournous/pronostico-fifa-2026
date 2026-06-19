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
  readOnly = true
}) {
  const [home, setHome] = useState(prediction?.home_score ?? '')
  const [away, setAway] = useState(prediction?.away_score ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // 🔒 BLOQUEO ABSOLUTO REAL
  const editable = false

  const status = getMatchStatus(match)

  async function handleSave() {
    return // 🔒 NO HACE NADA
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
            value={home}
            disabled
            placeholder="-"
          />

          <span className="score-separator">:</span>

          <input
            type="number"
            value={away}
            disabled
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
          Puntos obtenidos: <span>{prediction.points ?? 0}</span> / 5
        </div>
      )}

      <div className="match-result">
        🔒 Pronósticos deshabilitados
      </div>
    </div>
  )
}