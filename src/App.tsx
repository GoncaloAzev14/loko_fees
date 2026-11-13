import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import RequireAdmin from './components/RequireAdmin'
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
import Money from './pages/admin/Money'
import Payments from './pages/admin/Payments'
import Roster from './pages/admin/Roster'
import Settings from './pages/admin/Settings'

/** Public read-only screens, plus /admin/* which only admins can open. */
export default function App() {
  return (
    <Routes>
      <Route path="login" element={<Login />} />
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
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
