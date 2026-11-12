import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { fanPositions } from '../lib/fan'
import { ADMIN_LINKS } from './adminLinks'
import { HomeIcon, LoginIcon, PlusIcon, ReceiptIcon, UsersIcon, WalletIcon } from './icons'

const tab = ({ isActive }: { isActive: boolean }) => (isActive ? 'dk on' : 'dk')
const positions = fanPositions(ADMIN_LINKS.length)

/**
 * The bottom bar (phones only; wide screens get the sidebar).
 * The centre button logs in when nobody is signed in; for an admin it opens a menu whose
 * options swing out in an arc.
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
          <div className={`fan${open ? ' open' : ''}`} role="menu" aria-label="Administração" aria-hidden={!open}>
            {ADMIN_LINKS.map(({ to, label, shortLabel, Icon }, i) => (
              <Link
                key={to}
                to={to}
                role="menuitem"
                aria-label={label}
                tabIndex={open ? 0 : -1}
                ref={i === 0 ? first : undefined}
                className="fan-item"
                style={{ '--cx': positions[i].cx, '--cy': positions[i].cy, '--i': i } as CSSProperties}
                onClick={() => setOpen(false)}
              >
                <Icon />
                <span className={`fan-label${i === 1 || i === ADMIN_LINKS.length - 2 ? ' above' : ''}`}>{shortLabel ?? label}</span>
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
        <NavLink to="/caixa" className={tab}><WalletIcon />Caixa</NavLink>
      </nav>
    </>
  )
}
