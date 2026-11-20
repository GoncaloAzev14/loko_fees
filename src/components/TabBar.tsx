import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { ADMIN_LINKS } from './adminLinks'
import { HomeIcon, LoginIcon, PlusIcon, ListIcon, ReceiptIcon, UsersIcon } from './icons'

const tab = ({ isActive }: { isActive: boolean }) => (isActive ? 'dk on' : 'dk')

/**
 * The bottom bar (phones only; wide screens get the sidebar).
 * The centre button logs in when nobody is signed in; for an admin it opens a menu whose
 * options swing up as a stack.
 */
export default function TabBar() {
  const { isAdmin } = useAuth()
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const orb = useRef<HTMLButtonElement>(null)
  const first = useRef<HTMLAnchorElement>(null)

  useEffect(() => setOpen(false), [pathname, isAdmin])

  useEffect(() => {
    if (!open) return
    first.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      orb.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      {isAdmin && (
        <>
          <div className={`scrim${open ? ' open' : ''}`} onClick={() => setOpen(false)} aria-hidden="true" />
          <div className={`menu${open ? ' open' : ''}`} role="menu" aria-label="Administração" inert={!open}>
            {ADMIN_LINKS.map(({ to, label, Icon }, i) => (
              <Link
                key={to}
                to={to}
                role="menuitem"
                aria-current={pathname === to ? 'page' : undefined}
                ref={i === 0 ? first : undefined}
                className={`menu-item${pathname === to ? ' current' : ''}`}
                style={{ '--i': i, '--tilt': i % 2 ? '-8deg' : '8deg' } as CSSProperties}
                onClick={() => setOpen(false)}
              >
                <span className="mi"><Icon /></span>
                {label}
              </Link>
            ))}
          </div>
        </>
      )}

      <nav className="dock" aria-label="Principal">
        <NavLink to="/" end className={tab}><HomeIcon />Início</NavLink>
        <NavLink to="/players" className={tab}><UsersIcon />Jogadores</NavLink>
        <div className="mid">
          {isAdmin ? (
            <button
              ref={orb}
              className={`orb${open ? ' open' : ''}`}
              aria-label={open ? 'Fechar menu de administração' : 'Abrir menu de administração'}
              aria-expanded={open}
              aria-haspopup="menu"
              onClick={() => setOpen((o) => !o)}
            >
              <PlusIcon />
            </button>
          ) : (
            <Link to="/login" className="orb" aria-label="Entrar como administrador"><LoginIcon /></Link>
          )}
          {isAdmin ? 'Menu' : 'Entrar'}
        </div>
        <NavLink to="/fines" className={tab}><ReceiptIcon />Multas</NavLink>
        <NavLink to="/tabela" className={tab}><ListIcon />Tabela</NavLink>
      </nav>
    </>
  )
}
