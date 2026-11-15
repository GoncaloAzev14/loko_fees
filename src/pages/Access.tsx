import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import AuthFrame from '../components/AuthFrame'
import { EyeIcon, EyeOffIcon, LockIcon, MailIcon } from '../components/icons'
import { ErrorNote } from '../components/ui'
import { finishAccess, requestAccessCode } from '../lib/api'
import { useAuth } from '../lib/auth'

/**
 * First access after an invitation, or a forgotten password. No link has to work: the person asks
 * for a code by email, then types it here with a new password. Can be repeated as often as needed.
 */
export default function Access() {
  const { loading, isAdmin, completeFirstAccess } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (loading) return <p className="muted pad" style={{ textAlign: 'center' }}>A carregar…</p>
  if (isAdmin) return <Navigate to="/" replace />

  async function send(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await requestAccessCode(email)
      setStep('code')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar o código.')
    } finally {
      setBusy(false)
    }
  }

  async function finish(e: FormEvent) {
    e.preventDefault()
    if (password.length < 8) return setError('A palavra-passe deve ter pelo menos 8 caracteres.')
    setBusy(true)
    setError(null)
    try {
      await finishAccess(email, code, password)
      completeFirstAccess()
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível guardar a palavra-passe.')
    } finally {
      setBusy(false)
    }
  }

  const back = () => {
    setStep('email')
    setError(null)
  }

  return (
    <AuthFrame title="Primeiro acesso">
      {step === 'email' ? (
        <form onSubmit={send}>
          <p className="muted small">Escreva o email do convite. Enviamos-lhe um código para escolher a palavra-passe.</p>
          <label className="lf-label" htmlFor="email">Email</label>
          <div className="lf">
            <MailIcon className="ic sm" />
            <input
              id="email" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false}
              placeholder="o.seu@email.com" required value={email} onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <ErrorNote error={error} />
          <button className="btn login-btn" disabled={busy}>{busy ? 'A enviar…' : 'Enviar código'}</button>
          <button type="button" className="lf-link" disabled={!email.trim()} onClick={() => setStep('code')}>Já tenho um código</button>
          <Link className="lf-link" to="/login">Voltar a Entrar</Link>
        </form>
      ) : (
        <form onSubmit={finish}>
          <p className="muted small" role="status">Se <strong>{email.trim()}</strong> estiver convidado, enviámos um código. Pode demorar um minuto.</p>
          <label className="lf-label" htmlFor="code">Código</label>
          <div className="lf">
            <MailIcon className="ic sm" />
            <input
              id="code" className="code-input" inputMode="numeric" autoComplete="one-time-code" autoCapitalize="none" autoCorrect="off" spellCheck={false}
              placeholder="000000" required value={code} onChange={(e) => setCode(e.target.value)}
            />
          </div>

          <label className="lf-label" htmlFor="password">Nova palavra-passe</label>
          <div className="lf">
            <LockIcon className="ic sm" />
            <input
              id="password" type={show ? 'text' : 'password'} autoComplete="new-password" minLength={8}
              placeholder="mínimo 8 caracteres" required value={password} onChange={(e) => setPassword(e.target.value)}
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
          <button className="btn login-btn" disabled={busy}>{busy ? 'A guardar…' : 'Guardar e entrar'}</button>
          <button type="button" className="lf-link" onClick={back}>Pedir um código novo</button>
        </form>
      )}
    </AuthFrame>
  )
}
