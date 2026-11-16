import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import AuthFrame from '../components/AuthFrame'
import { EyeIcon, EyeOffIcon, LockIcon, MailIcon } from '../components/icons'
import { ErrorNote } from '../components/ui'
import { finishAccess, requestAccessCode } from '../lib/api'
import { useAuth } from '../lib/auth'
import { MIN_PASSWORD_LENGTH, PASSWORD_HINT, passwordProblem } from '../lib/password'

type Step = 'choose' | 'email' | 'code'

/**
 * First access after an invitation, or a forgotten password. No link has to work: the person gets a
 * code by email, then types it here with a new password. It can be repeated as often as needed.
 * Two ways in: "send me a code" or "I already have one".
 */
export default function Access() {
  const { loading, isAdmin, completeFirstAccess } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [step, setStep] = useState<Step>('choose')
  const [sent, setSent] = useState(false) // a code was just requested from this page
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (loading) return <p className="muted pad" style={{ textAlign: 'center' }}>A carregar…</p>
  if (isAdmin) return <Navigate to="/" replace />

  const go = (next: Step) => {
    setStep(next)
    setError(null)
  }

  async function send(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await requestAccessCode(email)
      setSent(true)
      setStep('code')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar o código.')
    } finally {
      setBusy(false)
    }
  }

  async function finish(e: FormEvent) {
    e.preventDefault()
    const problem = passwordProblem(password)
    if (problem) return setError(problem)
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

  const emailField = (
    <>
      <label className="lf-label" htmlFor="email">Email</label>
      <div className="lf">
        <MailIcon className="ic sm" />
        <input
          id="email" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false}
          placeholder="o.seu@email.com" required value={email} onChange={(e) => setEmail(e.target.value)}
        />
      </div>
    </>
  )

  return (
    <AuthFrame title="Primeiro acesso">
      {step === 'choose' && (
        <>
          <p className="muted small">Foi convidado por um administrador? Escolha como quer continuar.</p>
          <button className="btn login-btn" onClick={() => go('email')}>Enviar-me um código</button>
          <button className="btn secondary login-btn next" onClick={() => { setSent(false); go('code') }}>Já tenho um código</button>
          <Link className="lf-link" to="/login">Voltar a Entrar</Link>
        </>
      )}

      {step === 'email' && (
        <form onSubmit={send}>
          <p className="muted small">Escreva o email do convite. Enviamos-lhe um código para escolher a palavra-passe.</p>
          {emailField}
          <ErrorNote error={error} />
          <button className="btn login-btn" disabled={busy}>{busy ? 'A enviar…' : 'Enviar código'}</button>
          <button type="button" className="lf-link" onClick={() => go('choose')}>Voltar</button>
        </form>
      )}

      {step === 'code' && (
        <form onSubmit={finish}>
          {sent ? (
            <p className="muted small" role="status">Se <strong>{email.trim()}</strong> estiver convidado, enviámos um código. Pode demorar um minuto.</p>
          ) : (
            <>
              <p className="muted small">Escreva o email do convite e o código que recebeu.</p>
              {emailField}
            </>
          )}
          <label className="lf-label" htmlFor="code">Código</label>
          <div className="lf">
            <MailIcon className="ic sm" />
            <input
              id="code" className="code-input" inputMode="numeric" autoComplete="one-time-code" autoCapitalize="none" autoCorrect="off" spellCheck={false}
              placeholder="código do email" required value={code} onChange={(e) => setCode(e.target.value)}
            />
          </div>

          <label className="lf-label" htmlFor="password">Nova palavra-passe</label>
          <div className="lf">
            <LockIcon className="ic sm" />
            <input
              id="password" type={show ? 'text' : 'password'} autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH}
              placeholder={`mínimo ${MIN_PASSWORD_LENGTH} caracteres`} required value={password} onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button" className="lf-eye" aria-pressed={show}
              aria-label={show ? 'Esconder palavra-passe' : 'Mostrar palavra-passe'}
              onClick={() => setShow((v) => !v)}
            >
              {show ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          <p className="muted small" style={{ margin: '0.4rem 0 0' }}>{PASSWORD_HINT}</p>

          <ErrorNote error={error} />
          <button className="btn login-btn" disabled={busy}>{busy ? 'A guardar…' : 'Guardar e entrar'}</button>
          <button type="button" className="lf-link" onClick={() => go('email')}>{sent ? 'Pedir um código novo' : 'Não tenho um código'}</button>
        </form>
      )}
    </AuthFrame>
  )
}
