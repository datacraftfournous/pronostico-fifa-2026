import { formatKickoffColombia, getMatchStatus, statusLabel } from '../lib/scoring'

export default function MatchCard({
  match,
  prediction,
  showPoints = false
}) {
  const status = getMatchStatus(match)

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
            value={prediction?.home_score ?? ''}
            disabled
          />
          <span className="score-separator">:</span>
          <input
            type="number"
            value={prediction?.away_score ?? ''}
            disabled
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
          Puntos obtenidos: <span>{prediction.points ?? 0}</span> / 5
        </div>
      )}
    </div>
  )
}