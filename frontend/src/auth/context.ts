import { createContext } from 'react'
import type { Me } from '../lib/types'

export type AuthState = {
  me: Me | null
  loading: boolean
  /** Store the logged-in member after login, signup or invite acceptance. */
  setMe: (me: Me | null) => void
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)
