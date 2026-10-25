import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { NotificationBell } from './NotificationBell'
import { Badge } from './ui'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:text-slate-900'}`

const LINKS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/obligations', label: 'Obligations' },
  { to: '/reports', label: 'Reports' },
  { to: '/team', label: 'Team' },
  { to: '/settings', label: 'Settings' },
]

/** Top bar + page area for everything behind login. On phones the links scroll sideways. */
export function AppLayout() {
  const { me, logout } = useAuth()
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = useState(false)
  if (!me) return null

  async function handleLogout() {
    setLoggingOut(true)
    await logout().catch(() => undefined)
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 pt-3 md:pb-3">
          <NavLink to="/" className="shrink-0 text-lg font-semibold tracking-tight">
            Due<span className="text-indigo-600">Proof</span>
          </NavLink>
          <nav className="hidden flex-1 items-center gap-1 md:flex" aria-label="Main">
            {LINKS.map((l) => <NavLink key={l.to} to={l.to} end={l.end} className={navLinkClass}>{l.label}</NavLink>)}
          </nav>
          <div className="ml-auto flex items-center gap-2 text-sm md:ml-0">
            <NotificationBell />
            <div className="hidden text-right leading-tight sm:block">
              <p className="font-medium text-slate-900">{me.member.name}</p>
              <p className="text-xs text-slate-500">{me.org.name}</p>
            </div>
            <Badge tone={me.member.role === 'admin' ? 'indigo' : 'slate'}>{me.member.role}</Badge>
            <button onClick={handleLogout} disabled={loggingOut}
              className="rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900">
              Log out
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 py-2 md:hidden" aria-label="Main">
          {LINKS.map((l) => <NavLink key={l.to} to={l.to} end={l.end} className={navLinkClass}>{l.label}</NavLink>)}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  )
}
