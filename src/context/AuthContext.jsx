import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from "../lib/supabase"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Error cargando perfil:', error.message)
      return null
    }
    return data
  }, [])

  // Registra un acceso en login_logs. No bloquea la UI si falla
  // (solo lo dejamos en consola) para que un problema de tracking
  // nunca le impida a alguien usar la app.
  const registrarAcceso = useCallback(async (userId) => {
    try {
      const { error } = await supabase
        .from('login_logs')
        .insert({ user_id: userId })

      if (error) console.error('No se pudo registrar el login:', error.message)
    } catch (err) {
      console.error('No se pudo registrar el login:', err)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return
      setUser(session?.user ?? null)
      if (session?.user) {
        const p = await loadProfile(session.user.id)
        if (mounted) setProfile(p)
      }
      if (mounted) setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        setUser(session?.user ?? null)

        if (session?.user) {
          const p = await loadProfile(session.user.id)
          if (mounted) setProfile(p)

          // Solo registramos el momento del login real, no cada
          // refresco de token ni la carga inicial de sesión.
          if (event === 'SIGNED_IN') {
            registrarAcceso(session.user.id)
          }
        } else {
          setProfile(null)
        }
        if (mounted) setLoading(false)
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [loadProfile, registrarAcceso])

  async function signOut() {
    await supabase.auth.signOut()
  }

  const isAdmin = profile?.is_admin === true

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
