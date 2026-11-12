import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export default function RequireAdmin() {
  const { loading, isAdmin } = useAuth()
  if (loading) return <p className="muted pad">A carregar…</p>
  return isAdmin ? <Outlet /> : <Navigate to="/login" replace />
}
