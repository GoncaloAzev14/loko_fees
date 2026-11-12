import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { ErrorNote } from '../components/ui'
import { useAuth } from '../lib/auth'

export default function Login() {
  const { loading, session, isAdmin, signIn, signOut } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (loading) return <p className="muted pad">A carregar…</p>
  if (isAdmin) return <Navigate to="/admin" replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signIn(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao entrar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <h1>Entrar</h1>
      <p className="muted">Só os administradores precisam de entrar. Para consultar, não é preciso iniciar sessão.</p>
      {session ? (
        <div className="card">
          <p className="error">Esta conta não tem permissões de administrador.</p>
          <button className="btn secondary" onClick={signOut}>Terminar sessão</button>
        </div>
      ) : (
        <form className="card form" onSubmit={submit}>
          <label className="field" htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <label className="field" htmlFor="password">Palavra-passe</label>
          <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <ErrorNote error={error} />
          <button className="btn" disabled={busy}>{busy ? 'A entrar…' : 'Entrar'}</button>
        </form>
      )}
    </>
  )
}
