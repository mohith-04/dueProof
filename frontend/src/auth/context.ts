import { createContext } from 'react'
import type { Me } from '../lib/types'

export type AuthState = {
  me: Me | null
  loading: boolean
  /** The login check itself failed (server down or erroring), so we don't know who is logged in. */
  unavailable: boolean
  /** Run the login check again (used by the "server unavailable" screen). */
  retry: () => void
  /** Store the logged-in member after login, signup or invite acceptance. */
  setMe: (me: Me | null) => void
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)
