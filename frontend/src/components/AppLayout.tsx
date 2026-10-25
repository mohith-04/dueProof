import { NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { NotificationBell } from './NotificationBell'
import { Badge } from './ui'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:text-slate-900'}`

/** Top bar + page area for everything behind login. */
export function AppLayout() {
  const { me, logout } = useAuth()
  const navigate = useNavigate()
  if (!me) return null

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <NavLink to="/" className="text-lg font-semibold tracking-tight">
            Due<span className="text-indigo-600">Proof</span>
          </NavLink>
          <nav className="flex flex-1 flex-wrap items-center gap-1" aria-label="Main">
            <NavLink to="/" end className={navLinkClass}>
              Dashboard
            </NavLink>
            <NavLink to="/obligations" className={navLinkClass}>
              Obligations
            </NavLink>
            <NavLink to="/reports" className={navLinkClass}>
              Reports
            </NavLink>
            <NavLink to="/team" className={navLinkClass}>
              Team
            </NavLink>
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <NotificationBell />
            <div className="text-right leading-tight">
              <p className="font-medium text-slate-900">{me.member.name}</p>
              <p className="text-xs text-slate-500">{me.org.name}</p>
            </div>
            <Badge tone={me.member.role === 'admin' ? 'indigo' : 'slate'}>{me.member.role}</Badge>
            <button onClick={handleLogout} className="rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900">
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
