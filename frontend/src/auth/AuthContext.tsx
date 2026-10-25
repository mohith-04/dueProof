import { useCallback, useEffect, useState } from 'react'
import { api, ApiError, ensureCsrfCookie } from '../lib/api'
import type { Me } from '../lib/types'
import { AuthContext } from './context'

/**
 * Knows who is logged in. On first load it gets the CSRF cookie, then asks
 * /api/auth/me/: it returns the member, or null when nobody is logged in.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ensureCsrfCookie()
      .then(() => api<Me | null>('/auth/me/'))
      .then(setMe)
      .catch((error: unknown) => {
        if (!(error instanceof ApiError && error.status === 403)) console.error(error)
        setMe(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const logout = useCallback(async () => {
    await api('/auth/logout/', 'POST')
    setMe(null)
  }, [])

  return <AuthContext.Provider value={{ me, loading, setMe, logout }}>{children}</AuthContext.Provider>
}
