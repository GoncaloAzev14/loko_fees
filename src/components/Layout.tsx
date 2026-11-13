import { useEffect, useLayoutEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useClubName } from '../lib/hooks'
import { ADMIN_LINKS } from './adminLinks'
import { HomeIcon, LoginIcon, ReceiptIcon, TrainIcon, UsersIcon, WalletIcon } from './icons'
import TabBar from './TabBar'

const nav = ({ isActive }: { isActive: boolean }) => (isActive ? 'active' : undefined)

function Brand() {
  const name = useClubName()
  return (
    <div className="brand">
      <span className="brand-tile"><TrainIcon /></span>
      {name}
    </div>
  )
}

/** Every page opens at the top, whatever the previous one was scrolled to. */
function ScrollToTop() {
  const { pathname } = useLocation()
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

/**
 * One layout for every screen size: a bottom tab bar on phones, a sidebar on
 * wider screens (switched in CSS only).
 */
export default function Layout() {
  const { isAdmin, session, signOut } = useAuth()
  const name = useClubName()
  useEffect(() => {
    document.title = name
  }, [name])
  return (
    <div className="shell">
      <ScrollToTop />
      <aside className="sidebar">
        <Brand />
        <nav aria-label="Principal">
          <NavLink to="/" end className={nav}><HomeIcon />Início</NavLink>
          <NavLink to="/players" className={nav}><UsersIcon />Jogadores</NavLink>
          <NavLink to="/fines" className={nav}><ReceiptIcon />Multas</NavLink>
          <NavLink to="/caixa" className={nav}><WalletIcon />Caixa</NavLink>
          {isAdmin ? (
            <>
              <div className="nav-heading">Administração</div>
              {ADMIN_LINKS.map(({ to, label, Icon }) => (
                <NavLink key={to} to={to} className={nav}><Icon />{label}</NavLink>
              ))}
            </>
          ) : (
            <NavLink to="/login" className={nav}><LoginIcon />Entrar (admin)</NavLink>
          )}
        </nav>
        {session && <button className="link signout" onClick={signOut}>Terminar sessão</button>}
      </aside>

      <header className="topbar">
        <div className="topbar-in">
          <Brand />
          {session && <button className="link" onClick={signOut}>Sair</button>}
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <TabBar />
    </div>
  )
}
