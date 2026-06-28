import { toZonedTime } from 'date-fns-tz'
import { isBefore, subHours } from 'date-fns'

export const COLOMBIA_TZ = 'America/Bogota'

// A partir de este id, los partidos pertenecen a fase eliminatoria.
// Los 72 partidos de fase de grupos ya están cerrados (ids 1-72).
export const GROUP_STAGE_LAST_ID = 72

export function isKnockoutMatch(match) {
  return match.id > GROUP_STAGE_LAST_ID
}

export function nowInColombia() {
  return toZonedTime(new Date(), COLOMBIA_TZ)
}

export function kickoffInColombia(isoDate) {
  return toZonedTime(new Date(isoDate), COLOMBIA_TZ)
}

// ─── FASE DE GRUPOS (sin cambios) ───────────────────────────────

export function canEditPrediction(match) {
  if (match.is_finished) return false
  const dateStr = match.kickoff_at || match.match_date
  if (!dateStr) return true
  const kickoff = kickoffInColombia(dateStr)
  const now = nowInColombia()
  return isBefore(now, kickoff)
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

// ─── FASE ELIMINATORIA (dieciseisavos en adelante) ──────────────

// Se bloquea 1 hora antes del kickoff, no al iniciar el partido.
export function canEditKnockoutPrediction(match) {
  if (match.is_finished) return false
  const dateStr = match.kickoff_at || match.match_date
  if (!dateStr) return true
  const kickoff = kickoffInColombia(dateStr)
  const limite = subHours(kickoff, 1)
  const now = nowInColombia()
  return isBefore(now, limite)
}

// Puntaje verificado fila por fila contra la tabla de referencia.
// Máximo 6.00 puntos (marcador exacto = bono completo).
export function calcularPuntosEliminatoria(predLocal, predVisitante, realLocal, realVisitante) {
  const diffPred = predLocal - predVisitante
  const diffReal = realLocal - realVisitante

  const signoCorrecto =
    (diffPred > 0 && diffReal > 0) ||
    (diffPred < 0 && diffReal < 0) ||
    (diffPred === 0 && diffReal === 0)

  if (!signoCorrecto) {
    const acertoUnMarcador = predLocal === realLocal || predVisitante === realVisitante
    return acertoUnMarcador ? 1.0 : 0.0
  }

  const exacto = predLocal === realLocal && predVisitante === realVisitante
  const unoExacto = (predLocal === realLocal) !== (predVisitante === realVisitante) // XOR

  let base
  let error

  if (exacto) {
    base = 5.0
    error = 0
  } else if (unoExacto) {
    base = 3.0
    error = Math.abs(predLocal - realLocal) + Math.abs(predVisitante - realVisitante)
  } else {
    base = 2.0
    error = Math.abs(diffPred - diffReal)
  }

  const bonoPorError = { 0: 1.0, 1: 0.75, 2: 0.5, 3: 0.25 }
  const bono = bonoPorError[error] ?? 0.0

  return base + bono
}

// ─── COMUNES ─────────────────────────────────────────────────────

// Edición unificada: decide qué regla de bloqueo aplica según la fase.
export function canEditAnyPrediction(match) {
  return isKnockoutMatch(match)
    ? canEditKnockoutPrediction(match)
    : canEditPrediction(match)
}

// Puntaje unificado: decide qué fórmula aplica según la fase.
export function calcularPuntosAny(predLocal, predVisitante, realLocal, realVisitante, match) {
  return isKnockoutMatch(match)
    ? calcularPuntosEliminatoria(predLocal, predVisitante, realLocal, realVisitante)
    : calcularPuntos(predLocal, predVisitante, realLocal, realVisitante)
}

export function maxPuntosFor(match) {
  return isKnockoutMatch(match) ? 6 : 5
}

export function formatKickoffColombia(matchOrDateStr) {
  // Acepta tanto un objeto match como un string de fecha directo,
  // para mantener compatibilidad con llamadas existentes (ej. Admin.jsx).
  const dateStr =
    typeof matchOrDateStr === 'string'
      ? matchOrDateStr
      : matchOrDateStr?.kickoff_at || matchOrDateStr?.match_date

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

export function getMatchStatus(match) {
  if (match.is_finished) return 'finalizado'
  if (!canEditAnyPrediction(match)) return 'en_juego'
  return 'pendiente'
}

export function statusLabel(status) {
  const labels = { pendiente: 'Pendiente', en_juego: 'En juego', finalizado: 'Finalizado' }
  return labels[status] || status
}
