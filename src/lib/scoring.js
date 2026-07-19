import { toZonedTime } from 'date-fns-tz'
//import { isBefore, subHours } from 'date-fns'
import { isBefore, subMinutes } from 'date-fns'

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

// NOTA: el comentario original decía "se bloquea 1 hora antes", pero
// el código usa subMinutes(kickoff, 1) — bloquea 1 MINUTO antes, no
// 1 hora. Lo dejo tal cual estaba (por si fue un cambio intencional
// para pruebas), pero avísame si en realidad quieres que sea 1 hora
// y lo ajusto.
export function canEditKnockoutPrediction(match) {
  if (match.is_finished) return false
  const dateStr = match.kickoff_at || match.match_date
  if (!dateStr) return true
  const kickoff = kickoffInColombia(dateStr)
  // const limite = subHours(kickoff, 1)
  const limite = subMinutes(kickoff, 1)
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

// ─── BONO "QUIÉN AVANZA DE RONDA" ────────────────────────────────
//
// Independiente del marcador de 90'. Resuelve el caso donde el
// partido termina empatado y se define por penales (que ningún
// pronóstico de marcador puede "acertar"). Se suma al puntaje del
// marcador, no lo reemplaza.

export const BONO_AVANCE = 1

// match.advancing_team = equipo que REALMENTE avanzó (lo llena el admin)
// prediction.predicted_advancer = equipo que el jugador dijo que avanzaría
export function calcularBonoAvance(predictedAdvancer, advancingTeamReal) {
  if (!predictedAdvancer || !advancingTeamReal) return 0
  return predictedAdvancer === advancingTeamReal ? BONO_AVANCE : 0
}

// ─── MULTIPLICADOR POR FASE ───────────────────────────────────────
//
// Entre más avanza el torneo, cada partido vale más. Esto comprime
// la diferencia de puntos: una mala racha del líder en semis/final
// pesa mucho más que una del mismo tamaño en fase de grupos, y una
// buena racha del último en esas rondas puede acortar la brecha de
// golpe. El valor real vive en la columna `matches.multiplier`
// (se asigna solo según la fase, ver SQL), así que este helper solo
// LEE ese valor — no decide nada por su cuenta, para que siempre
// puedas auditar en la base de datos qué multiplicador tiene cada
// partido y corregirlo a mano si hace falta.
export function multiplicadorParaMatch(match) {
  const valor = Number(match?.multiplier)
  return Number.isFinite(valor) && valor > 0 ? valor : 1
}

// ─── COMODÍN (doble puntos) ──────────────────────────────────────
//
// Cada jugador puede usarlo en UN SOLO partido de toda la eliminatoria
// (garantizado a nivel de base de datos con un índice único parcial).
// Se aplica DESPUÉS del multiplicador de fase — así que usarlo en la
// final (x3) es mucho más poderoso que usarlo en octavos (x1.5).

export function aplicarComodin(puntosBase, esComodin) {
  return esComodin ? puntosBase * 2 : puntosBase
}

// Puntaje TOTAL de un pronóstico de eliminatoria:
//   (marcador + bono de avance) × multiplicador de fase × (2 si hay comodín)
//
// prediction: { home_score, away_score, predicted_advancer, joker }
// match:      { home_score, away_score, advancing_team, multiplier }
export function calcularPuntosEliminatoriaCompleto(prediction, match) {
  const puntosMarcador = calcularPuntosEliminatoria(
    prediction.home_score,
    prediction.away_score,
    match.home_score,
    match.away_score
  )

  const bonoAvance = calcularBonoAvance(prediction.predicted_advancer, match.advancing_team)

  const puntosBase = puntosMarcador + bonoAvance
  const multiplicador = multiplicadorParaMatch(match)
  const puntosConMultiplicador = puntosBase * multiplicador

  return aplicarComodin(puntosConMultiplicador, prediction.joker === true)
}

// ─── PREDICCIONES ESPECIALES (campeón + goleador) ────────────────
//
// Se califican una sola vez, cuando termine el torneo. Todos arrancan
// en 0, así que es la apuesta más pareja que existe en este momento.

export const PUNTOS_CAMPEON = 20
export const PUNTOS_GOLEADOR = 15

// Fecha límite para elegir/editar campeón y goleador. Después de esta
// fecha y hora (zona Colombia) el formulario ya no debe permitir
// guardar ni cambiar estas dos predicciones.
export const SPECIAL_PREDICTIONS_DEADLINE = '2026-07-19T19:45:59-05:00'

export function canEditSpecialPrediction() {
  const now = nowInColombia()
  const limite = kickoffInColombia(SPECIAL_PREDICTIONS_DEADLINE)
  return isBefore(now, limite)
}

// specialPrediction: { predicted_champion, predicted_top_scorer }
// resultadoTorneo:   { champion, top_scorer } (de tournament_results)
export function calcularPuntosEspeciales(specialPrediction, resultadoTorneo) {
  if (!specialPrediction || !resultadoTorneo) return 0

  let puntos = 0

  if (
    specialPrediction.predicted_champion &&
    specialPrediction.predicted_champion === resultadoTorneo.champion
  ) {
    puntos += PUNTOS_CAMPEON
  }

  if (
    specialPrediction.predicted_top_scorer &&
    specialPrediction.predicted_top_scorer === resultadoTorneo.top_scorer
  ) {
    puntos += PUNTOS_GOLEADOR
  }

  return puntos
}

// ─── COMUNES ─────────────────────────────────────────────────────

// Edición unificada: decide qué regla de bloqueo aplica según la fase.
export function canEditAnyPrediction(match) {
  return isKnockoutMatch(match)
    ? canEditKnockoutPrediction(match)
    : canEditPrediction(match)
}

// Puntaje unificado: decide qué fórmula aplica según la fase.
// Para eliminatoria usa el cálculo COMPLETO (marcador + avance + comodín)
// cuando se le pasa la predicción/partido completos; si solo recibe los
// 4 marcadores (compatibilidad con código existente), calcula solo el
// puntaje del marcador sin bonos.
export function calcularPuntosAny(
  predLocal,
  predVisitante,
  realLocal,
  realVisitante,
  match,
  prediction = null
) {
  if (!isKnockoutMatch(match)) {
    return calcularPuntos(predLocal, predVisitante, realLocal, realVisitante)
  }

  const base = calcularPuntosEliminatoria(
    predLocal,
    predVisitante,
    realLocal,
    realVisitante
  )

  const bono = prediction
    ? calcularBonoAvance(prediction.predicted_advancer, match.advancing_team)
    : 0
   /* Bug , No valida los puntos del Joker , Issue by Hector y Bryan*/

  const total = (base + bono) * multiplicadorParaMatch(match)
  return aplicarComodin(total, prediction?.joker === true)
}

export function maxPuntosFor(match) {
  if (!isKnockoutMatch(match)) return 5
  // 6 del marcador + 1 del bono de avance = 7, multiplicado por la
  // fase. El comodín (x2 adicional) no se cuenta aquí porque es
  // opcional y se usa una sola vez en todo el torneo.
  const base = 6 + BONO_AVANCE
  return base * multiplicadorParaMatch(match)
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


// ─── MULTIPLICADOR SEGÚN FASE (para asignarlo al CREAR el partido) ──
//
// multiplicadorParaMatch() de arriba LEE match.multiplier ya guardado.
// Esta función en cambio DECIDE qué multiplicador asignarle a un
// partido nuevo, según la fase seleccionada en el formulario de Admin.
// Los partidos 73-88 (dieciseisavos, ya jugados) quedan en 1 y no se
// tocan retroactivamente.
export const MULTIPLICADOR_POR_FASE = {
  'Octavos': 1.5,
  'Cuartos': 2,
  'Semifinal': 2.5,
  'Tercer puesto': 2.5,
  'Final': 3,
}

export function multiplicadorPorFase(stage) {
  return MULTIPLICADOR_POR_FASE[stage] ?? 1
}

// ─── DESGLOSE DE PUNTOS (para mostrarle al usuario CÓMO se calculó) ──
//
// Estas funciones NO reemplazan a calcularPuntos / calcularPuntosEliminatoria*.
// Reutilizan exactamente la misma lógica paso a paso, pero en vez de
// devolver solo el número final, devuelven cada componente por separado
// (con una etiqueta en español lista para mostrar en la UI) para que la
// suma de `items` + bonos siempre cuadre con lo que devuelven las
// funciones de arriba. Si el día de mañana cambia una regla de puntaje,
// hay que cambiarla en AMBOS lados (el cálculo y su desglose).

// Desglose de fase de grupos. Espejo de calcularPuntos().
export function desglosarPuntosGrupos(predLocal, predVisitante, realLocal, realVisitante) {
  const items = []
  let total = 0

  const marcadorExacto = predLocal === realLocal && predVisitante === realVisitante
  items.push({ label: 'Marcador exacto', puntos: marcadorExacto ? 1 : 0, logrado: marcadorExacto })
  if (marcadorExacto) total += 1

  const resPred = Math.sign(predLocal - predVisitante)
  const resReal = Math.sign(realLocal - realVisitante)
  const acertoGanador = resPred === resReal
  items.push({ label: 'Acertó ganador/empate', puntos: acertoGanador ? 1 : 0, logrado: acertoGanador })
  if (acertoGanador) total += 1

  const acertoLocal = predLocal === realLocal
  items.push({ label: `Acertó goles del local (${realLocal})`, puntos: acertoLocal ? 1 : 0, logrado: acertoLocal })
  if (acertoLocal) total += 1

  const acertoVisitante = predVisitante === realVisitante
  items.push({ label: `Acertó goles del visitante (${realVisitante})`, puntos: acertoVisitante ? 1 : 0, logrado: acertoVisitante })
  if (acertoVisitante) total += 1

  const diffPred = predLocal - predVisitante
  const diffReal = realLocal - realVisitante
  const acertoDiferencia = acertoGanador && diffPred === diffReal
  items.push({ label: 'Acertó diferencia de gol', puntos: acertoDiferencia ? 1 : 0, logrado: acertoDiferencia })
  if (acertoDiferencia) total += 1

  return { items, total }
}

// Desglose de fase eliminatoria. Espejo de calcularPuntosEliminatoria().
export function desglosarPuntosEliminatoria(predLocal, predVisitante, realLocal, realVisitante) {
  const diffPred = predLocal - predVisitante
  const diffReal = realLocal - realVisitante

  const signoCorrecto =
    (diffPred > 0 && diffReal > 0) ||
    (diffPred < 0 && diffReal < 0) ||
    (diffPred === 0 && diffReal === 0)

  if (!signoCorrecto) {
    const acertoUnMarcador = predLocal === realLocal || predVisitante === realVisitante
    const puntos = acertoUnMarcador ? 1.0 : 0.0
    const items = [
      { label: 'No acertó el resultado (ni ganador ni empate)', puntos: 0, logrado: false },
      {
        label: acertoUnMarcador ? 'Acertó uno de los dos marcadores' : 'No acertó ningún marcador',
        puntos,
        logrado: acertoUnMarcador,
      },
    ]
    return { items, total: puntos, tipo: 'signo_incorrecto' }
  }

  const exacto = predLocal === realLocal && predVisitante === realVisitante
  const unoExacto = (predLocal === realLocal) !== (predVisitante === realVisitante) // XOR

  let base
  let error
  let tipoLabel
  let tipo

  if (exacto) {
    base = 5.0
    error = 0
    tipoLabel = 'Marcador exacto'
    tipo = 'exacto'
  } else if (unoExacto) {
    base = 3.0
    error = Math.abs(predLocal - realLocal) + Math.abs(predVisitante - realVisitante)
    tipoLabel = 'Acertó uno de los dos marcadores (con resultado correcto)'
    tipo = 'uno_exacto'
  } else {
    base = 2.0
    error = Math.abs(diffPred - diffReal)
    tipoLabel = 'Acertó el resultado (ganador/empate), sin marcador exacto'
    tipo = 'resultado'
  }

  const bonoPorError = { 0: 1.0, 1: 0.75, 2: 0.5, 3: 0.25 }
  const bono = bonoPorError[error] ?? 0.0

  const items = [
    { label: 'Acertó el resultado (ganador/empate)', puntos: 0, logrado: true },
    { label: tipoLabel, puntos: base, logrado: true },
    { label: `Bono por margen de error (Δ=${error})`, puntos: bono, logrado: bono > 0 },
  ]

  return { items, total: base + bono, tipo }
}

// Desglose COMPLETO de fase de grupos (marcador + fase 1x, sin bonos
// de eliminatoria). Se deja envuelto en la misma forma que el de
// eliminatoria para que el componente de UI pueda tratarlos igual.
export function desglosarPuntosGruposCompleto(prediction, match) {
  const marcador = desglosarPuntosGrupos(
    prediction.home_score,
    prediction.away_score,
    match.home_score,
    match.away_score
  )

  return {
    items: marcador.items,
    puntosMarcador: marcador.total,
    bonoAvance: 0,
    puntosBase: marcador.total,
    multiplicador: 1,
    esComodin: false,
    puntosConMultiplicador: marcador.total,
    total: marcador.total,
  }
}

// Desglose COMPLETO de fase eliminatoria:
//   marcador (items) + bono de avance, luego × multiplicador de fase,
//   luego × 2 si hubo comodín. Espejo de calcularPuntosEliminatoriaCompleto().
export function desglosarPuntosEliminatoriaCompleto(prediction, match) {
  const marcador = desglosarPuntosEliminatoria(
    prediction.home_score,
    prediction.away_score,
    match.home_score,
    match.away_score
  )

  const bonoAvance = calcularBonoAvance(prediction.predicted_advancer, match.advancing_team)
  const multiplicador = multiplicadorParaMatch(match)
  const esComodin = prediction.joker === true

  const puntosBase = marcador.total + bonoAvance
  const puntosConMultiplicador = puntosBase * multiplicador
  const total = aplicarComodin(puntosConMultiplicador, esComodin)

  return {
    items: marcador.items,
    puntosMarcador: marcador.total,
    bonoAvance,
    puntosBase,
    multiplicador,
    esComodin,
    puntosConMultiplicador,
    total,
  }
}

// Desglose unificado: decide qué fórmula aplica según la fase.
// Devuelve { items, puntosMarcador, bonoAvance, puntosBase, multiplicador, esComodin, puntosConMultiplicador, total }
export function desglosarPuntosAny(prediction, match) {
  return isKnockoutMatch(match)
    ? desglosarPuntosEliminatoriaCompleto(prediction, match)
    : desglosarPuntosGruposCompleto(prediction, match)
}