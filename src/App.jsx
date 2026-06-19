import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Ranking from './pages/Ranking'
import Predictions from './pages/Predictions'
import Admin from './pages/Admin'
import Rules from './pages/Rules'
import PublicPredictions from './pages/PublicPredictions'

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, profile, loading, isAdmin } = useAuth()

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader" />
        <p>Cargando...</p>
      </div>
    )
  }

  if (!user || !profile) return <Navigate to="/login" replace />
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />

  return children
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader" />
        <p>Cargando...</p>
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <Login />}
      />

      <Route path="/pronosticos-publicos" element={<PublicPredictions />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Ranking />} />
        <Route path="pronosticos" element={<Predictions />} />
        <Route path="reglas" element={<Rules />} />
        <Route
          path="admin"
          element={
            <ProtectedRoute adminOnly>
              <Admin />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}