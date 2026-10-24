import { BrowserRouter, Route, Routes } from 'react-router'
import { AuthProvider } from './auth/AuthContext'
import { RedirectIfLoggedIn, RequireAuth } from './auth/RequireAuth'
import { AppLayout } from './components/AppLayout'
import AcceptInvitePage from './pages/AcceptInvitePage'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import ObligationDetailPage from './pages/ObligationDetailPage'
import ObligationFormPage from './pages/ObligationFormPage'
import ObligationsPage from './pages/ObligationsPage'
import SignupPage from './pages/SignupPage'
import StatusPage from './pages/StatusPage'
import TeamPage from './pages/TeamPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Logged-out pages */}
          <Route element={<RedirectIfLoggedIn />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
          </Route>
          <Route path="/invite/:token" element={<AcceptInvitePage />} />
          <Route path="/status" element={<div className="p-8"><StatusPage /></div>} />

          {/* Everything else needs a logged-in member */}
          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/obligations" element={<ObligationsPage />} />
              <Route path="/obligations/new" element={<ObligationFormPage />} />
              <Route path="/obligations/:id" element={<ObligationDetailPage />} />
              <Route path="/obligations/:id/edit" element={<ObligationFormPage />} />
              <Route path="/team" element={<TeamPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
