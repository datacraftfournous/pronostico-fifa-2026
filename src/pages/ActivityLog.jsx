import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

// Nombres legibles para cada ruta de la app
const NOMBRES_PAGINA = {
  '/': '🏆 Ranking',
  '/Predictions': '🎯 Prediction',
  '/daily-prediction': '📅 Daily Prediction',
  '/analisis': '📈 Analysis',
  '/reglas': '📋 Rules',
  '/admin': '⚙️ Admin',
  '/actividad': '📊 Actividad',
}

function nombrePagina(path) {
  return NOMBRES_PAGINA[path] || path
}

// Trae TODAS las filas de una tabla paginando de a 1000
// (el límite por defecto de Supabase/PostgREST)
async function fetchAllRows(table, columns, orderBy) {
  const pageSize = 1000
  let from = 0
  let allRows = []

  while (true) {
    let query = supabase.from(table).select(columns).range(from, from + pageSize - 1)
    if (orderBy) query = query.order(orderBy.column, { ascending: orderBy.ascending ?? false })

    const { data, error } = await query
    if (error) throw error
    if (!data || data.length === 0) break

    allRows.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }

  return allRows
}

function formatFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ActivityLog() {
  const [profiles, setProfiles] = useState([])
  const [logins, setLogins] = useState([])
  const [pageViews, setPageViews] = useState([])
  const [loading, setLoading] = useState(true)
  const [usuarioFiltro, setUsuarioFiltro] = useState('todos')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [profilesData, loginsData, pageViewsData] = await Promise.all([
        fetchAllRows('profiles', 'id, display_name, is_admin'),
        fetchAllRows('login_logs', 'user_id, created_at', { column: 'created_at' }),
        fetchAllRows('page_views', 'user_id, path, created_at', { column: 'created_at' }),
      ])

      setProfiles(profilesData)
      setLogins(loginsData)
      setPageViews(pageViewsData)
    } catch (err) {
      console.error('Error cargando actividad:', err)
    } finally {
      setLoading(false)
    }
  }

  const perfilPorId = useMemo(
    () => new Map(profiles.map((p) => [p.id, p])),
    [profiles]
  )

  // Resumen por usuario: último login, total logins, total vistas, última vista
  const resumenUsuarios = useMemo(() => {
    const base = new Map(
      profiles.map((p) => [
        p.id,
        {
          user_id: p.id,
          display_name: p.display_name,
          ultimoLogin: null,
          totalLogins: 0,
          totalVistas: 0,
          ultimaVista: null,
          ultimaPagina: null,
        },
      ])
    )

    logins.forEach((l) => {
      const u = base.get(l.user_id)
      if (!u) return
      u.totalLogins += 1
      if (!u.ultimoLogin || l.created_at > u.ultimoLogin) u.ultimoLogin = l.created_at
    })

    pageViews.forEach((v) => {
      const u = base.get(v.user_id)
      if (!u) return
      u.totalVistas += 1
      if (!u.ultimaVista || v.created_at > u.ultimaVista) {
        u.ultimaVista = v.created_at
        u.ultimaPagina = v.path
      }
    })

    return Array.from(base.values()).sort((a, b) => {
      const fa = a.ultimaVista || a.ultimoLogin || ''
      const fb = b.ultimaVista || b.ultimoLogin || ''
      return fb.localeCompare(fa)
    })
  }, [profiles, logins, pageViews])

  // Feed de actividad reciente (últimas 50 vistas), filtrable por usuario
  const feedReciente = useMemo(() => {
    const filtradas = usuarioFiltro === 'todos'
      ? pageViews
      : pageViews.filter((v) => v.user_id === usuarioFiltro)

    return [...filtradas]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 50)
      .map((v) => ({
        ...v,
        display_name: perfilPorId.get(v.user_id)?.display_name || '—',
      }))
  }, [pageViews, usuarioFiltro, perfilPorId])

  // Páginas más visitadas en general
  const paginasPopulares = useMemo(() => {
    const conteo = {}
    pageViews.forEach((v) => {
      conteo[v.path] = (conteo[v.path] || 0) + 1
    })
    return Object.entries(conteo).sort((a, b) => b[1] - a[1])
  }, [pageViews])

  const usuariosActivosHoy = useMemo(() => {
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
    const idsHoy = new Set(
      pageViews
        .filter((v) => new Date(v.created_at).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }) === hoy)
        .map((v) => v.user_id)
    )
    return idsHoy.size
  }, [pageViews])

  if (loading) {
    return (
      <div className="loading-screen" style={{ minHeight: '200px' }}>
        <div className="loader" />
      </div>
    )
  }

  const maxVistasPagina = Math.max(...paginasPopulares.map(([, c]) => c), 1)

  return (
    <div>
      <h2 className="page-title">📊 Actividad de usuarios</h2>
      <p className="page-subtitle">Quién entra, cuándo, y qué páginas visita</p>

      {/* KPIs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div className="card" style={{ padding: '1.1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            👥 Usuarios registrados
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--gold)' }}>
            {profiles.length}
          </div>
        </div>

        <div className="card" style={{ padding: '1.1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            🟢 Activos hoy
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--gold)' }}>
            {usuariosActivosHoy}
          </div>
        </div>

        <div className="card" style={{ padding: '1.1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            🔑 Total logins
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--gold)' }}>
            {logins.length}
          </div>
        </div>

        <div className="card" style={{ padding: '1.1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            👁️ Total vistas de página
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--gold)' }}>
            {pageViews.length}
          </div>
        </div>
      </div>

      {/* Resumen por usuario */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem', overflow: 'auto' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>👤 Última actividad por usuario</h3>
        <table className="ranking-table">
          <thead>
            <tr>
              <th>Participante</th>
              <th>Último login</th>
              <th># Logins</th>
              <th>Última página vista</th>
              <th># Vistas</th>
            </tr>
          </thead>
          <tbody>
            {resumenUsuarios.map((u) => (
              <tr key={u.user_id}>
                <td>{u.display_name}</td>
                <td className="rank-points">{formatFecha(u.ultimoLogin)}</td>
                <td className="rank-points">{u.totalLogins}</td>
                <td className="rank-points">
                  {u.ultimaPagina ? nombrePagina(u.ultimaPagina) : '—'}
                </td>
                <td className="rank-points">{u.totalVistas}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Páginas más populares */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>📈 Páginas más visitadas</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {paginasPopulares.map(([path, count]) => (
            <div key={path} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ width: '9rem', flexShrink: 0, fontSize: '0.85rem' }}>
                {nombrePagina(path)}
              </span>
              <div
                style={{
                  flex: 1,
                  height: '0.8rem',
                  borderRadius: '999px',
                  background: 'rgba(255,255,255,0.08)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${(count / maxVistasPagina) * 100}%`,
                    height: '100%',
                    background: 'var(--gold)',
                    borderRadius: '999px',
                  }}
                />
              </div>
              <span style={{ width: '2.5rem', textAlign: 'right', fontSize: '0.85rem' }}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Feed de actividad reciente */}
      <div className="card" style={{ padding: '1.5rem', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ margin: 0 }}>🕓 Actividad reciente</h3>
          <select
            className="date-select"
            value={usuarioFiltro}
            onChange={(e) => setUsuarioFiltro(e.target.value)}
          >
            <option value="todos">Todos los usuarios</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>{p.display_name}</option>
            ))}
          </select>
        </div>

        <table className="ranking-table">
          <thead>
            <tr>
              <th>Participante</th>
              <th>Página</th>
              <th>Hora</th>
            </tr>
          </thead>
          <tbody>
            {feedReciente.map((v, i) => (
              <tr key={i}>
                <td>{v.display_name}</td>
                <td>{nombrePagina(v.path)}</td>
                <td className="rank-points">{formatFecha(v.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {feedReciente.length === 0 && (
          <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>
            Aún no hay actividad registrada.
          </p>
        )}
      </div>
    </div>
  )
}
