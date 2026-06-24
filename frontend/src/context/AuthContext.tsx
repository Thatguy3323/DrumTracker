import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import axios from 'axios'

export interface AuthUser {
  id: string
  name: string
  profile_image: string | null
}

interface AuthState {
  user: AuthUser | null
  loading: boolean
  login: () => void
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    axios
      .get('/api/me')
      .then(({ data }) => { if (!cancelled) setUser(data) })
      .catch(() => { if (!cancelled) setUser(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  function login() {
    const h = window.location.host
    window.location.href = `https://replit.com/auth_with_replit_new?domain=${h}`
  }

  function logout() {
    // Clear the Replit auth cookie and reload so the app returns to the
    // logged-out state.
    document.cookie =
      'REPL_AUTH=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    setUser(null)
    window.location.href = '/'
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
