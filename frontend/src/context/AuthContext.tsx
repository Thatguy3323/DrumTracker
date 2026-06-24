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

  async function logout() {
    // The REPL_AUTH cookie is HttpOnly, so it must be expired server-side —
    // clearing it from JS is a no-op. Hit the backend logout endpoint first,
    // then clear any non-HttpOnly remnant as a fallback, and finally do a full
    // page navigation so the proxy re-evaluates auth on the next request.
    try {
      await axios.post('/api/logout')
    } catch {
      // Ignore — we still reload below so the app reflects a logged-out state.
    }
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
