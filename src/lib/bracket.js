import { supabase } from './supabase'

// ganador del partido
function getWinner(match) {
  if (match.home_score > match.away_score) return match.home_team
  if (match.away_score > match.home_score) return match.away_team

  return match.advancing_team || null
}

// evitar duplicados de ronda
async function roundExists(stage) {
   
  const { data } = await supabase
    .from('matches')
    .select('id')
    .eq('stage', stage)

  return data && data.length > 0
}
const BRACKET = {
  89: { matches: [74, 77], stage: 'Octavos' },
  90: { matches: [73, 75], stage: 'Octavos' },
  91: { matches: [76, 78], stage: 'Octavos' },
  92: { matches: [79, 80], stage: 'Octavos' },
  93: { matches: [83, 84], stage: 'Octavos' },
  94: { matches: [81, 82], stage: 'Octavos' },
  95: { matches: [86, 88], stage: 'Octavos' },
  96: { matches: [85, 87], stage: 'Octavos' },
}

export async function tryCreateNextMatch(bracketSlot) {
  const next = Object.entries(BRACKET).find(([, value]) =>
    value.matches.includes(bracketSlot)
  )

  if (!next) return

  const [nextSlot, config] = next

  const { data: existing } = await supabase
  .from('matches')
  .select('id')
  .eq('bracket_slot', Number(nextSlot))
  .maybeSingle()

  const { data: previousMatches } = await supabase
  .from('matches')
  .select('*')
  .in('bracket_slot', config.matches)

if (!previousMatches || previousMatches.length !== 2) return

const winners = previousMatches
  .sort((a, b) => config.matches.indexOf(a.bracket_slot) - config.matches.indexOf(b.bracket_slot))
  .map(m => m.advancing_team)

if (winners.some(w => !w)) return

console.log('INSERTANDO', {
  home_team: winners[0],
  away_team: winners[1],
  stage: config.stage,
  multiplier:
    config.stage === 'Octavos' ? 1.5 :
    config.stage === 'Cuartos' ? 2 :
    config.stage === 'Semifinal' ? 2.5 :
    config.stage === 'Final' ? 3 :
    1,
})

if (existing) {
  await supabase
    .from('matches')
    .update({
      home_team: winners[0],
      away_team: winners[1],
    })
    .eq('id', existing.id)
} else {
  await supabase
    .from('matches')
    .insert([{
      home_team: winners[0],
      away_team: winners[1],
      stage: config.stage,
      bracket_slot: Number(nextSlot),
      is_finished: false,
      kickoff_at: null,
    }])
}
}
