import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Layout() {
  const { profile, isAdmin, signOut } = useAuth()

  const linkClass = ({ isActive }) =>
    `nav-link${isActive ? ' active' : ''}`

  return (
    <div className="app-layout">
      <header className="app-header">
   
   <div className="logo">
  <span className="logo-icon">⚽</span>
  <div>
    <h1>POLLA FIFA 2026</h1>
    <span>Pronósticos Familia y amigos</span>
    <br />
    <span style={{ 
  fontSize: '0.65rem',
  color: '#ffffff',
  fontWeight: 700,
  textShadow: `
    0 0 5px #ffffff,
    0 0 10px #ffffff,
    0 0 15px #ffffff,
    0 0 20px #ffffff,
    0 0 30px rgba(255,255,255,0.8)
  `
}}>
  Developed by Jhonny Alberto Anaya Mattos - Tiburon Flag 🦈
</span>
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
      </nav>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}