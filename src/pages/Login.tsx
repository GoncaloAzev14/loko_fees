import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { EyeIcon, EyeOffIcon, LockIcon, MailIcon } from '../components/icons'
import Logo from '../components/Logo'
import TabBar from '../components/TabBar'
import { ErrorNote } from '../components/ui'
import { useAuth } from '../lib/auth'
import { contourPaths } from '../lib/contours'
import { useClubName } from '../lib/hooks'

const HERO_W = 390
const HERO_H = 380

/** Admin sign-in. A full screen of its own: no header or tab bar around it. */
export default function Login() {
  const { loading, session, isAdmin, signIn, signOut } = useAuth()
  const club = useClubName()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const lines = useMemo(() => contourPaths(HERO_W, HERO_H), [])

  useEffect(() => {
    document.title = club
  }, [club])

  if (loading) return <p className="muted pad" style={{ textAlign: 'center' }}>A carregar…</p>
  if (isAdmin) return <Navigate to="/" replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signIn(email.trim(), password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao entrar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
    <div className="login-screen">
      <div className="login-hero">
        <svg className="login-lines" viewBox={`0 0 ${HERO_W} ${HERO_H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          {lines.map((d, i) => <path key={i} d={d} />)}
        </svg>
        <Logo className="login-crest" />
        <svg className="login-wave" viewBox="0 0 390 80" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 46C70 6 128 8 196 36S330 76 390 30V80H0Z" />
        </svg>
      </div>

      <div className="login-panel">
        <h1>Área de administração</h1>

        {session ? (
          <div className="card">
            <p className="error" role="alert">Esta conta não tem permissões de administrador.</p>
            <button className="btn secondary" onClick={signOut}>Terminar sessão</button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label className="lf-label" htmlFor="email">Email</label>
            <div className="lf">
              <MailIcon className="ic sm" />
              <input
                id="email" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                placeholder="o.seu@email.com" required value={email} onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <label className="lf-label" htmlFor="password">Palavra-passe</label>
            <div className="lf">
              <LockIcon className="ic sm" />
              <input
                id="password" type={show ? 'text' : 'password'} autoComplete="current-password"
                placeholder="••••••••" required value={password} onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button" className="lf-eye" aria-pressed={show}
                aria-label={show ? 'Esconder palavra-passe' : 'Mostrar palavra-passe'}
                onClick={() => setShow((v) => !v)}
              >
                {show ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>

            <ErrorNote error={error} />
            <button className="btn login-btn" disabled={busy}>{busy ? 'A entrar…' : 'Entrar'}</button>
          </form>
        )}

        <p className="login-back">Só quer consultar? <Link to="/">Continuar sem entrar</Link></p>
      </div>
    </div>
    <TabBar />
    </>
  )
}
