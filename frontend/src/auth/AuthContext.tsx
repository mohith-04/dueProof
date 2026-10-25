import { useCallback, useEffect, useState } from 'react'
import { api, ensureCsrfCookie } from '../lib/api'
import type { Me } from '../lib/types'
import { AuthContext } from './context'

/**
 * Knows who is logged in. On first load it gets the CSRF cookie, then asks
 * /api/auth/me/: it returns the member, or null when nobody is logged in.
 * If that check fails, the app shows a "server unavailable" screen instead of
 * pretending the user is logged out.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    ensureCsrfCookie()
      .then(() => api<Me | null>('/auth/me/'))
      .then((result) => {
        setMe(result)
        setUnavailable(false)
      })
      .catch((error: unknown) => {
        console.error(error)
        setUnavailable(true)
      })
      .finally(() => setLoading(false))
  }, [attempt])

  const retry = useCallback(() => {
    setLoading(true)
    setAttempt((n) => n + 1)
  }, [])

  const logout = useCallback(async () => {
    await api('/auth/logout/', 'POST')
    setMe(null)
  }, [])

  return (
    <AuthContext.Provider value={{ me, loading, unavailable, retry, setMe, logout }}>{children}</AuthContext.Provider>
  )
}
