import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'

const ADMIN_LINKS = [
  ['/admin/fines/new', 'Registar multa'],
  ['/admin/payments', 'Pagamentos'],
  ['/admin/money', 'Receitas e despesas'],
  ['/admin/catalog', 'Tipos de multa'],
  ['/admin/players', 'Plantel'],
  ['/admin/settings', 'Definições'],
] as const

const nav = ({ isActive }: { isActive: boolean }) => (isActive ? 'active' : undefined)

/**
 * One layout for every screen size: a bottom tab bar on phones, a sidebar on
 * wider screens (switched in CSS only).
 */
export default function Layout() {
  const { isAdmin, session, signOut } = useAuth()
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">Loko Fees</div>
        <nav>
          <NavLink to="/" end className={nav}>Início</NavLink>
          <NavLink to="/players" className={nav}>Jogadores</NavLink>
          <NavLink to="/fines" className={nav}>Multas</NavLink>
          {isAdmin ? (
            <>
              <div className="nav-heading">Administração</div>
              {ADMIN_LINKS.map(([to, label]) => (
                <NavLink key={to} to={to} className={nav}>{label}</NavLink>
              ))}
            </>
          ) : (
            <NavLink to="/login" className={nav}>Entrar (admin)</NavLink>
          )}
        </nav>
        {session && (
          <button className="link signout" onClick={signOut}>Terminar sessão</button>
        )}
      </aside>

      <header className="topbar">
        <span className="brand">Loko Fees</span>
        {session && <button className="link" onClick={signOut}>Sair</button>}
      </header>

      <main>
        <Outlet />
      </main>

      <nav className="tabbar" aria-label="Principal">
        <NavLink to="/" end className={nav}>Início</NavLink>
        <NavLink to="/players" className={nav}>Jogadores</NavLink>
        <NavLink to="/fines" className={nav}>Multas</NavLink>
        {isAdmin ? <NavLink to="/admin" className={nav}>Admin</NavLink> : <NavLink to="/login" className={nav}>Entrar</NavLink>}
      </nav>
    </div>
  )
}

export function AdminHub() {
  return (
    <>
      <h1>Administração</h1>
      <ul className="list hub">
        {ADMIN_LINKS.map(([to, label]) => (
          <li key={to} className="row">
            <NavLink to={to} className="row-title">{label} ›</NavLink>
          </li>
        ))}
      </ul>
    </>
  )
}
