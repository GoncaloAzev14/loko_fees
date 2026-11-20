import { useEffect, useLayoutEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useClubName } from '../lib/hooks'
import { ADMIN_LINKS } from './adminLinks'
import { HomeIcon, ListIcon, LoginIcon, LogoutIcon, ReceiptIcon, UsersIcon } from './icons'
import IconButton from './IconButton'
import Logo from './Logo'
import SyncChip from './SyncChip'
import TabBar from './TabBar'

const nav = ({ isActive }: { isActive: boolean }) => (isActive ? 'active' : undefined)

function Brand() {
  const name = useClubName()
  return (
    <div className="brand">
      <Logo className="brand-logo" />
      <span className="brand-name">{name}</span>
    </div>
  )
}

/** Every page opens at the top, whatever the previous one was scrolled to. (#root is what scrolls.) */
function ScrollToTop() {
  const { pathname } = useLocation()
  useLayoutEffect(() => {
    document.getElementById('root')?.scrollTo(0, 0)
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
          <NavLink to="/players" className={nav}><UsersIcon />Plantel</NavLink>
          <NavLink to="/fines" className={nav}><ReceiptIcon />Multas</NavLink>
          <NavLink to="/regulamento" className={nav}><ListIcon />Regulamento</NavLink>
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
        <SyncChip />
        {session && <div className="signout"><IconButton Icon={LogoutIcon} label="Terminar sessão" onClick={signOut} /></div>}
      </aside>

      <header className="topbar">
        <div className="topbar-in">
          <Brand />
          <div className="topbar-end">
            <SyncChip />
            {session && <IconButton Icon={LogoutIcon} label="Sair" onClick={signOut} />}
          </div>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <TabBar />
    </div>
  )
}
