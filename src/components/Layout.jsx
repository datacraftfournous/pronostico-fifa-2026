import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import logoTF from '../assets/Tiburon_Flag_Icon.jpeg'


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

  const linkClass = ({ isActive }) =>
    `nav-link${isActive ? ' active' : ''}`

  return (
    <div className="app-layout">
      <header className="app-header">

        <div className="logo">
          <img
            src={logoTF}
            alt="Tiburón Flag"
            className="brand-logo"
          />

          <div>
            <h1>FLAGSCORE</h1>

            <div className="brand-subtitle">
              Sports Predictions & Analytics
            </div>

            <div className="brand-company">
              by Tiburón Flag
            </div>


          </div>
        </div >


        <div className="header-user">
          <span>
            Hola, <span className="username">{profile?.display_name}</span>
          </span>
          <button className="btn-logout" onClick={signOut}>
            Salir
          </button>
        </div>
      </header >

      <div className="competition-banner">
        🏆 FIFA World Cup 2026
      </div>
      
      <nav className="app-nav">
        <NavLink to="/" end className={linkClass}>
          🏆 Ranking
        </NavLink>

        <NavLink to="/Predictions" end className={linkClass}>
          🎯 Prediction
        </NavLink>

        <NavLink to="/daily-prediction" end className={linkClass}>
          📅 Daily Prediction
        </NavLink>

        <NavLink to="/analisis" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          📈 Analysis
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
    </div >
  )
}
