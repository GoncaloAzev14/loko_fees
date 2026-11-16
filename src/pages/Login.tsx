import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { EyeIcon, EyeOffIcon, LockIcon, MailIcon } from '../components/icons'
import AuthFrame from '../components/AuthFrame'
import { ErrorNote } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useClubName } from '../lib/hooks'

/** Admin sign-in. A full screen of its own: no header or tab bar around it. */
export default function Login() {
  const { loading, session, isAdmin, pendingInvite, signIn, signOut } = useAuth()
  const club = useClubName()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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
    <AuthFrame title="Área de administração">
      {session ? (
        <div className="card">
          {pendingInvite ? (
            <>
              <p className="error" role="alert">O seu convite ainda não foi concluído.</p>
              <p className="muted small">Já está dentro: falta só escolher a palavra-passe.</p>
              <Link className="btn login-btn" to="/set-password">Escolher palavra-passe</Link>
            </>
          ) : (
            <p className="error" role="alert">Esta conta não tem permissões de administrador.</p>
          )}
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
          <Link className="lf-link" to="/recover">Primeiro acesso</Link>
        </form>
      )}
    </AuthFrame>
  )
}
