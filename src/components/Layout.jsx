import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import logoTF from '../assets/Tiburon_Flag_Icon.jpeg'
import { APP_VERSION } from '../version'
import TodayMatchesStrip from './TodayMatchesStrip'

export default function Layout() {
  const { profile, isAdmin, signOut, user } = useAuth()
  const location = useLocation()


  // Registra cada cambio de ruta como una "vista de página" en Supabase.
  // Layout nunca se desmonta entre navegaciones (envuelve el <Outlet/>),
  // así que este efecto se dispara exactamente una vez por cada
  // cambio real de path — no en cada render.
  useEffect(() => {
    if (!user) return

    supabase
      .from('page_views')
      .insert({ user_id: user.id, path: location.pathname })
      .then(({ error }) => {
        if (error) console.error('No se pudo registrar la visita:', error.message)
      })

  }, [location.pathname, user])

  useEffect(() => {
    const storedVersion = localStorage.getItem('app_version')
    if (storedVersion && storedVersion !== APP_VERSION) {
      localStorage.setItem('app_version', APP_VERSION)
      signOut()
      return
    }
    localStorage.setItem('app_version', APP_VERSION)
  }, [])

  const linkClass = ({ isActive }) =>
    `nav-link${isActive ? ' active' : ''}`

  return (
    <div className="app-layout">


      <header className="topbar">

        <div className="brand">

          <img
            src={logoTF}
            className="brand-logo"
            alt="logo"
          />

          <div className="brand-info">

            <div className="brand-powered">
              Powered by FlagScore
            </div>

            <h1 className="brand-title">
              🏆 Mundial 2026 Predictor
            </h1>

            <p className="brand-description">
              Compite con tus amigos, predice resultados y escala el ranking.
            </p>

          </div>

        </div>

        <div className="header-user">

          <div className="user-card">

            <div className="user-avatar">
              {profile?.display_name?.charAt(0)?.toUpperCase()}
            </div>

            <div>

              <div className="user-greeting">
                Hola
              </div>

              <div className="user-display-name">
                {profile?.display_name}
              </div>

            </div>

          </div>

          <button
            className="btn-logout"
            onClick={signOut}
          >
            Salir
          </button>

        </div>
      </header>
      <TodayMatchesStrip />

      <nav className="app-nav">
        <NavLink to="/" end className={linkClass}>
          🏆 Ranking
        </NavLink>

        <NavLink to="/Predictions" end className={linkClass}>
          ⚽ Matches
        </NavLink>

        <NavLink to="/daily-prediction" end className={linkClass}>
          🎯 Predictions
        </NavLink>

        <NavLink to="/points-breakdown" end className={linkClass}>
          🧮 Points Breakdown
        </NavLink>

        <NavLink to="/analisis" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          📊 Analytics
        </NavLink>

        <NavLink to="/reglas" className={linkClass}>
          📋 Rules
        </NavLink>

        {isAdmin && (
          <NavLink to="/admin" className={linkClass}>
            ⚙️ Admin
          </NavLink>
        )}

        {isAdmin && (
          <NavLink to="/actividad" className={linkClass}>
            📊 Actividad
          </NavLink>
        )}
      </nav>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
