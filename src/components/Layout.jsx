import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Layout() {
  const { profile, isAdmin, signOut } = useAuth()

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="logo">
          <span className="logo-icon">⚽</span>
          <div>
            <h1>POLLA FIFA 2026</h1>
            <span>Pronósticos entre amigos</span>
          </div>
        </div>
        <div className="header-user">
          <span>
            Hola, <span className="username">{profile?.display_name}</span>
          </span>
          <button className="btn-logout" onClick={signOut}>
            Salir
          </button>
        </div>
      </header>

      <nav className="app-nav">
        <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          🏆 Ranking
        </NavLink>
        <NavLink
  to="/daily-prediction"
  className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
>
  📅 Daily Prediction
</NavLink>
{/*
<NavLink to="/pronosticos" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
  📝 Mis pronósticos
</NavLink>
*/}        <NavLink to="/reglas" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          📋 Reglas
        </NavLink>
        {isAdmin && (
          <NavLink to="/admin" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            ⚙️ Admin
          </NavLink>
        )}
      </nav>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
