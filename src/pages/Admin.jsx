import { useEffect, useState } from 'react'
import { supabase, usernameToEmail } from '../lib/supabase'
import { calcularPuntosAny, formatKickoffColombia, multiplicadorPorFase } from '../lib/scoring'
import { tryCreateNextMatch } from '../lib/bracket'


export default function Admin() {
  const [tab, setTab] = useState('resultados')
  const [matches, setMatches] = useState([])
  const [profiles, setProfiles] = useState([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Nuevo usuario
  const [newUsername, setNewUsername] = useState('')
  const [newDisplayName, setNewDisplayName] = useState('')
  const [newPassword, setNewPassword] = useState('')

  // Nuevo partido
  const [homeTeam, setHomeTeam] = useState('')
  const [awayTeam, setAwayTeam] = useState('')
  const [stage, setStage] = useState('Grupo A')
  const [kickoffDate, setKickoffDate] = useState('')
  const [kickoffTime, setKickoffTime] = useState('15:00')

  // Resultado real
  const [resultMatchId, setResultMatchId] = useState('')
  const [resultHome, setResultHome] = useState('')
  const [resultAway, setResultAway] = useState('')
  const [advancingTeam, setAdvancingTeam] = useState('')
  const [showFinished, setShowFinished] = useState(false)
  const [resultStage, setResultStage] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [{ data: matchData }, { data: profileData }] = await Promise.all([
      supabase.from('matches').select('*').order('kickoff_at'),
      supabase.from('profiles').select('*').order('display_name'),
    ])
    setMatches(matchData || [])
    setProfiles(profileData || [])
  }

  function showMsg(msg) {
    setMessage(msg)
    setError('')
    setTimeout(() => setMessage(''), 4000)
  }

  async function handleCreateUser(e) {
    e.preventDefault()
    setError('')

    const email = usernameToEmail(newUsername)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password: newPassword,
      options: {
        data: {
          username: newUsername.toLowerCase(),
          display_name: newDisplayName || newUsername,
          role: 'user',
        },
      },
    })

    if (signUpError) {
      setError(`Error creando usuario: ${signUpError.message}`)
      return
    }

    if (data.user) {
      showMsg(`Usuario "${newDisplayName || newUsername}" creado. Comparte: usuario="${newUsername}" contraseña="${newPassword}"`)
      setNewUsername('')
      setNewDisplayName('')
      setNewPassword('')
      loadData()
    }
  }

  async function handleCreateMatch(e) {
    e.preventDefault()
    setError('')

    const kickoff = `${kickoffDate}T${kickoffTime}:00-05:00`

    const { error: insertError } = await supabase.from('matches').insert({
      home_team: homeTeam,
      away_team: awayTeam,
      stage,
      kickoff_at: kickoff,
      multiplier: multiplicadorPorFase(stage),   // 👈 NUEVO
    })

    if (insertError) {
      setError(`Error creando partido: ${insertError.message}`)
      return
    }

    showMsg(`Partido ${homeTeam} vs ${awayTeam} creado`)
    setHomeTeam('')
    setAwayTeam('')
    loadData()
  }

  async function handleSetResult(e) {
    e.preventDefault()
    setError('')

    const homeScore = parseInt(resultHome, 10)
    const awayScore = parseInt(resultAway, 10)
    const matchId = resultMatchId

    const knockoutStages = [
      'Dieciseisavos de final',
      'Octavos',
      'Cuartos',
      'Semifinal',
      'Tercer puesto',
      'Final',
    ]

    const match = matches.find((m) => String(m.id) === String(matchId))

    if (
      match &&
      knockoutStages.includes(match.stage) &&
      homeScore === awayScore &&
      !advancingTeam
    ) {
      setError('Debes seleccionar el equipo que avanza.')
      return
    }


    if (!match) {
      setError('No se encontró el partido seleccionado')
      return
    }

    if (Number.isNaN(homeScore) || Number.isNaN(awayScore)) {
      setError('El resultado ingresado no es válido')
      return
    }

    let winner = null

    if (homeScore > awayScore) {
      winner = match.home_team
    } else if (awayScore > homeScore) {
      winner = match.away_team
    } else {
      winner = advancingTeam
    }
    const { data: updatedMatch, error: updateError } = await supabase
      .from('matches')

      .update({
        home_score: homeScore,
        away_score: awayScore,
        advancing_team: winner,
        is_finished: true,
      })
      .eq('id', matchId)
      .select()
      .single()

    if (updateError || !updatedMatch) {
      setError(`Error guardando resultado: ${updateError?.message || 'sin datos'}`)
      return
    }

    const { data: predictions, error: predError } = await supabase
      .from('predictions')
      .select('*')
      .eq('match_id', matchId)

    if (predError) {
      setError(`Error leyendo predicciones: ${predError.message}`)
      return
    }

    // Usamos updatedMatch (lo que QUEDÓ guardado en la base, recién leído)
    // en vez de las variables locales homeScore/awayScore o el "match" de
    // estado viejo. Así, sin importar si el formulario quedó desincronizado
    // de alguna sesión anterior, los puntos siempre se calculan contra el
    // resultado real que de verdad está en la base de datos.
    let erroresCalculo = 0
    let fallosVerificacion = []

    for (const pred of predictions || []) {
      let predHome = parseInt(pred.home_score, 10)
      let predAway = parseInt(pred.away_score, 10)

      if (Number.isNaN(predHome) || Number.isNaN(predAway)) {
        erroresCalculo++
        predHome = Number.isNaN(predHome) ? 0 : predHome
        predAway = Number.isNaN(predAway) ? 0 : predAway
      }

      const points = calcularPuntosAny(
        predHome,
        predAway,
        updatedMatch.home_score,
        updatedMatch.away_score,
        updatedMatch,
        pred
      )

      const { data: savedRow, error: pointsError } = await supabase
        .from('predictions')
        .update({ points })
        .eq('id', pred.id)
        .select()
        .single()

      if (pointsError || !savedRow) {
        console.error('Error actualizando puntos de predicción', pred.id, pointsError)
        fallosVerificacion.push(`pred ${pred.id}: error al guardar`)
        continue
      }

      // Verificación dura: confirmamos que el valor que quedó en la base
      // es el mismo que acabamos de calcular. Si no coincide, lo reportamos
      // en vez de asumir que todo salió bien.
      const puntosCalculados = Number(points.toFixed(2))

      if (Number(savedRow.points) !== puntosCalculados) {
        fallosVerificacion.push(
          `pred ${pred.id}: calculado ${puntosCalculados} pero quedó guardado ${savedRow.points}`
        )
      }
    }

    if (fallosVerificacion.length > 0) {
      setError(
        `Resultado guardado para ${updatedMatch.home_team} ${updatedMatch.home_score}-${updatedMatch.away_score} ${updatedMatch.away_team}, ` +
        `pero ${fallosVerificacion.length} predicción(es) no se actualizaron correctamente: ${fallosVerificacion.join(' | ')}`
      )
    } else {
      showMsg(
        `Resultado guardado para ${updatedMatch.home_team} ${updatedMatch.home_score}-${updatedMatch.away_score} ${updatedMatch.away_team} (id ${updatedMatch.id}). Se recalcularon y verificaron ${(predictions || []).length} predicciones.`
      )
    }
    setResultMatchId('')
    setResultHome('')
    setResultAway('')
    setAdvancingTeam('')
    loadData()

    await tryCreateNextMatch(updatedMatch.bracket_slot)
    // ─── BRACKET AUTOMÁTICO ───

    const stageOrder = [
      'Dieciseisavos de final',
      'Octavos',
      'Cuartos',
      'Semifinal',
      'Final',
    ]
  }
  const pendingMatches = matches.filter((m) => !m.is_finished)
  const finishedMatches = matches.filter((m) => m.is_finished)
  const filteredPendingMatches = pendingMatches.filter(
    (m) => !resultStage || m.stage === resultStage
  )

  const filteredFinishedMatches = finishedMatches.filter(
    (m) => !resultStage || m.stage === resultStage
  )

  return (
    <div>
      <h2 className="page-title">⚙️ Panel Admin</h2>
      <p className="page-subtitle">Gestiona usuarios, partidos y resultados</p>

      {message && <div className="success-msg">{message}</div>}
      {error && <div className="error-msg">{error}</div>}

      <div className="tabs">
        {[
          ['resultados', 'Resultados'],
          // ['partidos', 'Partidos'],
          ['usuarios', 'Usuarios'],
        ].map(([key, label]) => (
          <button
            key={key}
            className={`tab${tab === key ? ' active' : ''}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'resultados' && (
        <div className="admin-section card">
          <h2>Marcar resultado real</h2>
          <form onSubmit={handleSetResult}>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={showFinished}
                  onChange={(e) => {
                    setShowFinished(e.target.checked)
                    setResultMatchId('')
                    setResultHome('')
                    setResultAway('')
                  }}
                  style={{ marginRight: '0.5rem' }}
                />
                Recalcular un partido ya finalizado
              </label>
            </div>

            <div className="form-group">
              <label>Fase</label>
              <select
                value={resultStage}
                onChange={(e) => {
                  setResultStage(e.target.value)
                  setResultMatchId('')
                }}
              >
                <option value="">Todas las fases</option>

                {[...new Set(matches.map((m) => m.stage))]
                  .sort()
                  .map((stage) => (
                    <option key={stage} value={stage}>
                      {stage}
                    </option>
                  ))}
              </select>
            </div>

            <div className="form-group">
              <label>Partido</label>
              <select
                value={resultMatchId}
                onChange={(e) => {
                  const id = e.target.value
                  setResultMatchId(id)
                  const m = matches.find((mm) => String(mm.id) === String(id))
                  // Al recalcular, precargamos el resultado actual para que
                  // el admin lo vea y lo edite, en vez de partir de inputs vacíos.
                  if (m && showFinished) {
                    setResultHome(String(m.home_score ?? ''))
                    setResultAway(String(m.away_score ?? ''))
                    setAdvancingTeam(m.advancing_team ?? '')
                  }
                }}
                required
              >
                <option value="">Selecciona un partido</option>
                {(showFinished ? filteredFinishedMatches : filteredPendingMatches).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.home_team} vs {m.away_team} — {formatKickoffColombia(m.kickoff_at)}
                    {showFinished ? ` (actual: ${m.home_score}-${m.away_score})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-grid admin-grid-2">
              <div className="form-group">
                <label>Goles local</label>
                <input
                  type="number"
                  min="0"
                  value={resultHome}
                  onChange={(e) => setResultHome(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Goles visitante</label>
                <input
                  type="number"
                  min="0"
                  value={resultAway}
                  onChange={(e) => setResultAway(e.target.value)}
                  required
                />
              </div>
            </div>

            {resultMatchId &&
              (() => {
                const m = matches.find(mm => String(mm.id) === String(resultMatchId))

                const knockoutStages = [
                  'Dieciseisavos de final',
                  'Octavos',
                  'Cuartos',
                  'Semifinal',
                  'Tercer puesto',
                  'Final',
                ]

                if (
                  !m ||
                  !knockoutStages.includes(m.stage) ||
                  resultHome === '' ||
                  resultAway === '' ||
                  Number(resultHome) !== Number(resultAway)
                ) {
                  return null
                }

                return (
                  <div className="form-group">
                    <label>Equipo que avanza</label>
                    <select
                      value={advancingTeam}
                      onChange={(e) => setAdvancingTeam(e.target.value)}
                      required
                    >
                      <option value="">Selecciona el clasificado</option>
                      <option value={m.home_team}>{m.home_team}</option>
                      <option value={m.away_team}>{m.away_team}</option>
                    </select>
                  </div>
                )
              })()}


            <button type="submit" className="btn btn-gold">
              Guardar resultado y calcular puntos
            </button>
          </form>
        </div>
      )}
      {/*
      {tab === 'partidos' && (
        <div className="admin-section card">
          <h2>Agregar partido</h2>
          <form onSubmit={handleCreateMatch}>
            <div className="admin-grid admin-grid-2">
              <div className="form-group">
                <label>Equipo local</label>
                <input value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Equipo visitante</label>
                <input value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)} required />
              </div>
            </div>
            <div className="admin-grid admin-grid-2">
              <div className="form-group">
                <label>Fase</label>
                <select value={stage} onChange={(e) => setStage(e.target.value)}>
                  {['Grupo A','Grupo B','Grupo C','Grupo D','Grupo E','Grupo F',
                    'Grupo G','Grupo H','Dieciseisavos de final','Octavos','Cuartos','Semifinal','Tercer puesto','Final'
                  ].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Fecha (Colombia)</label>
                <input type="date" value={kickoffDate} onChange={(e) => setKickoffDate(e.target.value)} required />
              </div>
            </div>
            <div className="form-group">
              <label>Hora (Colombia)</label>
              <input type="time" value={kickoffTime} onChange={(e) => setKickoffTime(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-primary">Agregar partido</button>
          </form>

          <div style={{ marginTop: '2rem' }}>
            <h3 style={{ color: 'var(--gold)', marginBottom: '1rem' }}>Partidos registrados ({matches.length})</h3>
            {matches.map((m) => (
              <div key={m.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.875rem' }}>
                <strong>{m.home_team}</strong> vs <strong>{m.away_team}</strong>
                {' '}· {m.stage} · {formatKickoffColombia(m.kickoff_at)}
                {m.is_finished && (
                  <span style={{ color: 'var(--green)', marginLeft: '0.5rem' }}>
                    ✓ {m.home_score}-{m.away_score}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

*/}

      {tab === 'usuarios' && (
        <div className="admin-section card">
          <h2>Crear participante</h2>
          <form onSubmit={handleCreateUser}>
            <div className="admin-grid admin-grid-2">
              <div className="form-group">
                <label>Usuario (para login)</label>
                <input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} required placeholder="Ej: juan" />
              </div>
              <div className="form-group">
                <label>Nombre para mostrar</label>
                <input value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} placeholder="Ej: Juan Pérez" />
              </div>
            </div>
            <div className="form-group">
              <label>Contraseña inicial</label>
              <input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
            </div>
            <button type="submit" className="btn btn-primary">Crear usuario</button>
          </form>

          <div style={{ marginTop: '2rem' }}>
            <h3 style={{ color: 'var(--gold)', marginBottom: '1rem' }}>Participantes ({profiles.length})</h3>
            {profiles.map((p) => (
              <div key={p.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.875rem' }}>
                <strong>{p.display_name}</strong>
                <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>@{p.username}</span>
                {p.role === 'admin' && <span style={{ color: 'var(--gold)', marginLeft: '0.5rem' }}>Admin</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
