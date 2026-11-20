import { useEffect, useRef } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import EnvBanner from './components/EnvBanner'
import SyncManager from './components/SyncManager'
import { useAuth } from './lib/auth'
import Layout from './components/Layout'
import RequireAdmin from './components/RequireAdmin'
import Access from './pages/Access'
import Caixa from './pages/Caixa'
import Dashboard from './pages/Dashboard'
import Fines from './pages/Fines'
import Login from './pages/Login'
import PlayerDetail from './pages/PlayerDetail'
import Players from './pages/Players'
import SetPassword from './pages/SetPassword'
import Admins from './pages/admin/Admins'
import AddFine from './pages/admin/AddFine'
import Archive from './pages/admin/Archive'
import Catalog from './pages/admin/Catalog'
import History from './pages/admin/History'
import Money from './pages/admin/Money'
import Payments from './pages/admin/Payments'
import Roster from './pages/admin/Roster'
import Settings from './pages/admin/Settings'

/**
 * Someone the invitation link signed in has not chosen a password yet, so they are not an admin yet.
 * The first time the app opens for them, take them straight to choosing one, instead of leaving them
 * on a page that looks as if nothing happened. Only once: after that they can look around freely.
 */
function InviteNudge() {
  const { pendingInvite } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const done = useRef(false)
  useEffect(() => {
    if (!pendingInvite) {
      done.current = false
      return
    }
    if (done.current || pathname === '/recover') return // on the first-access page they are already doing it
    done.current = true
    if (pathname !== '/set-password') navigate('/set-password', { replace: true })
  }, [pendingInvite, pathname, navigate])
  return null
}

/** Public read-only screens, plus /admin/* which only admins can open. */
export default function App() {
  return (
    <>
      <EnvBanner />
      <SyncManager />
      <InviteNudge />
      <Routes>
        <Route path="login" element={<Login />} />
        <Route path="recover" element={<Access />} />
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="players" element={<Players />} />
          <Route path="players/:id" element={<PlayerDetail />} />
          <Route path="fines" element={<Fines />} />
          <Route path="caixa" element={<Caixa />} />
          <Route path="set-password" element={<SetPassword />} />
          <Route path="admin" element={<RequireAdmin />}>
            <Route index element={<Navigate to="/" replace />} />
            <Route path="fines/new" element={<AddFine />} />
            <Route path="payments" element={<Payments />} />
            <Route path="money" element={<Money />} />
            <Route path="catalog" element={<Catalog />} />
            <Route path="players" element={<Roster />} />
            <Route path="admins" element={<Admins />} />
            <Route path="archive" element={<Archive />} />
          <Route path="history" element={<History />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </>
  )
}
