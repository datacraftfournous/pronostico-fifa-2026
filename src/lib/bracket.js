import { supabase } from './supabase'
import { multiplicadorPorFase } from './scoring'

const BRACKET = {
  // OCTAVOS
  89: { matches: [75, 78], stage: 'Octavos', kickoff_at: '2026-07-04T17:00:00Z' },
  90: { matches: [73, 76], stage: 'Octavos', kickoff_at: '2026-07-05T20:00:00Z' },
  91: { matches: [74, 77], stage: 'Octavos', kickoff_at: '2026-07-04T21:00:00Z' },
  92: { matches: [79, 80], stage: 'Octavos', kickoff_at: '2026-07-07T03:00:00Z' },
  93: { matches: [84, 83], stage: 'Octavos', kickoff_at: '2026-07-06T20:00:00Z' },
  94: { matches: [82, 81], stage: 'Octavos', kickoff_at: '2026-07-06T01:00:00Z' },
  95: { matches: [87, 86], stage: 'Octavos', kickoff_at: '2026-07-07T23:00:00Z' },
  96: { matches: [85, 88], stage: 'Octavos', kickoff_at: '2026-07-07T16:00:00Z' },

  // CUARTOS
  97: { matches: [89, 90], stage: 'Cuartos', kickoff_at: '2026-07-09T21:00:00Z' },
  98: { matches: [93, 94], stage: 'Cuartos', kickoff_at: '2026-07-10T20:00:00Z' },
  99: { matches: [91, 92], stage: 'Cuartos', kickoff_at: '2026-07-11T22:00:00Z' },
  100: { matches: [95, 96], stage: 'Cuartos', kickoff_at: '2026-07-12T02:00:00Z' },

  // SEMIFINALES
  101: { matches: [97, 98], stage: 'Semifinal', kickoff_at: '2026-07-14T20:00:00Z' },
  102: { matches: [99, 100], stage: 'Semifinal', kickoff_at: '2026-07-15T20:00:00Z' },

  // FINAL
  104: { matches: [101, 102], stage: 'Final', kickoff_at: '2026-07-19T20:00:00Z' },
}

export async function tryCreateNextMatch(bracketSlot) {
  const next = Object.entries(BRACKET).find(([, cfg]) =>
    cfg.matches.includes(bracketSlot)
  )

  if (!next) return

  const [nextSlot, config] = next

  const { data: previousMatches, error: prevError } = await supabase
    .from('matches')
    .select('*')
    .in('bracket_slot', config.matches)

  if (prevError || !previousMatches || previousMatches.length !== 2) return

  const ordered = previousMatches.sort(
    (a, b) =>
      config.matches.indexOf(a.bracket_slot) -
      config.matches.indexOf(b.bracket_slot)
  )

  const winners = ordered.map((m) => m.advancing_team)

  if (winners.some((w) => !w)) return

  const payload = {
    home_team: winners[0],
    away_team: winners[1],
    stage: config.stage,
    bracket_slot: Number(nextSlot),
    kickoff_at: config.kickoff_at,
    match_date: config.kickoff_at,
    multiplier: multiplicadorPorFase(config.stage),
    status: 'pendiente',
    is_finished: false,
    advancing_team: null,
  }

  const { data: existing } = await supabase
    .from('matches')
    .select('id')
    .eq('bracket_slot', Number(nextSlot))
    .maybeSingle()

  if (existing) {
    await supabase
      .from('matches')
      .update(payload)
      .eq('id', existing.id)

    await tryCreateNextMatch(Number(nextSlot))
    return
  }

  const { error } = await supabase
    .from('matches')
    .insert([payload])

  if (!error) {
    await tryCreateNextMatch(Number(nextSlot))
  }
}