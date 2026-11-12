import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ErrorNote } from '../components/ui'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

/**
 * Where the invitation email leads. Supabase signs the visitor in from the link,
 * so all that is left is choosing a password.
 */
export default function SetPassword() {
  const { loading, session } = useAuth()
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
        <p className="muted">Esta ligação expirou ou já foi usada. Peça um novo convite a um administrador ou <Link to="/login">entre</Link> com a sua palavra-passe.</p>
      </>
    )

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 8) return setError('A palavra-passe deve ter pelo menos 8 caracteres.')
    if (password !== repeat) return setError('As palavras-passe não coincidem.')
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) return setError(error.message)
    navigate('/admin', { replace: true })
  }

  return (
    <>
      <h1>Escolher palavra-passe</h1>
      <form className="card form" onSubmit={submit}>
        <label className="field" htmlFor="pw">Nova palavra-passe</label>
        <input id="pw" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        <label className="field" htmlFor="pw2">Repetir</label>
        <input id="pw2" type="password" autoComplete="new-password" required value={repeat} onChange={(e) => setRepeat(e.target.value)} />
        <ErrorNote error={error} />
        <button className="btn" disabled={busy}>{busy ? 'A guardar…' : 'Guardar e entrar'}</button>
      </form>
    </>
  )
}
