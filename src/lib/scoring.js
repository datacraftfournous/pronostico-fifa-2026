import { toZonedTime } from 'date-fns-tz'
import { isBefore } from 'date-fns'

export const COLOMBIA_TZ = 'America/Bogota'

export function nowInColombia() {
  return toZonedTime(new Date(), COLOMBIA_TZ)
}

export function kickoffInColombia(isoDate) {
  return toZonedTime(new Date(isoDate), COLOMBIA_TZ)
}

export function canEditPrediction(match) {
  if (match.is_finished) return false
  const dateStr = match.kickoff_at || match.match_date
  if (!dateStr) return true
  const kickoff = kickoffInColombia(dateStr)
  const now = nowInColombia()
  return isBefore(now, kickoff)
}

export function formatKickoffColombia(match) {
  const dateStr = match?.kickoff_at || match?.match_date
  if (!dateStr) return ''
  const date = kickoffInColombia(dateStr)
  return date.toLocaleString('es-CO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: COLOMBIA_TZ,
  })
}

export function calcularPuntos(predLocal, predVisitante, realLocal, realVisitante) {
  let puntos = 0

  if (predLocal === realLocal && predVisitante === realVisitante) puntos += 1

  const resPred = Math.sign(predLocal - predVisitante)
  const resReal = Math.sign(realLocal - realVisitante)
  const acertoGanador = resPred === resReal

  if (acertoGanador) puntos += 1
  if (predLocal === realLocal) puntos += 1
  if (predVisitante === realVisitante) puntos += 1

  const diffPred = predLocal - predVisitante
  const diffReal = realLocal - realVisitante
  if (acertoGanador && diffPred === diffReal) puntos += 1

  return puntos
}

export function getMatchStatus(match) {
  if (match.is_finished) return 'finalizado'
  if (!canEditPrediction(match)) return 'en_juego'
  return 'pendiente'
}

export function statusLabel(status) {
  const labels = { pendiente: 'Pendiente', en_juego: 'En juego', finalizado: 'Finalizado' }
  return labels[status] || status
}