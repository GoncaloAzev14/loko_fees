import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ErrorNote } from '../components/ui'
import { useAuth } from '../lib/auth'
import { MIN_PASSWORD_LENGTH, PASSWORD_HINT, passwordErrorMessage, passwordProblem } from '../lib/password'
import { supabase } from '../lib/supabase'

/**
 * Where the invitation email leads. Supabase signs the visitor in from the link,
 * so all that is left is choosing a password.
 */
export default function SetPassword() {
  const { loading, session, completeFirstAccess } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (loading) return <p className="muted pad">A carregar…</p>
  if (!session)
    return (
      <>
        <h1>Ligação inválida</h1>
        <p className="muted">Esta ligação expirou ou já foi usada. Não faz mal: peça um código novo e escolha a palavra-passe na mesma.</p>
        <Link className="btn" to="/recover">Receber um código novo</Link>
        <p className="muted small">Já tem palavra-passe? <Link to="/login">Entrar</Link></p>
      </>
    )

  async function submit(e: FormEvent) {
    e.preventDefault()
    const problem = passwordProblem(password)
    if (problem) return setError(problem)
    if (password !== repeat) return setError('As palavras-passe não coincidem.')
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) return setError(passwordErrorMessage(error))
    completeFirstAccess()
    navigate('/', { replace: true })
  }

  return (
    <>
      <h1>Escolher palavra-passe</h1>
      <form className="card form" onSubmit={submit}>
        <label className="field" htmlFor="pw">Nova palavra-passe</label>
        <input id="pw" type="password" autoComplete="new-password" required minLength={MIN_PASSWORD_LENGTH} value={password} onChange={(e) => setPassword(e.target.value)} />
        <p className="muted small">{PASSWORD_HINT}</p>
        <label className="field" htmlFor="pw2">Repetir</label>
        <input id="pw2" type="password" autoComplete="new-password" required value={repeat} onChange={(e) => setRepeat(e.target.value)} />
        <ErrorNote error={error} />
        <button className="btn" disabled={busy}>{busy ? 'A guardar…' : 'Guardar e entrar'}</button>
      </form>
    </>
  )
}
