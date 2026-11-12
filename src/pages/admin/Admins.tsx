import { useState, type FormEvent } from 'react'
import { Async, ErrorNote } from '../../components/ui'
import { inviteAdmin, removeAdmin } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useAction, useAdmins } from '../../lib/hooks'

/** Who can administer the club, and a way to invite more people by email. */
export default function Admins() {
  const { session } = useAuth()
  const q = useAdmins()
  const [email, setEmail] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const invite = useAction(async (to: string) => {
    const status = await inviteAdmin(to)
    setDone(status === 'invited' ? `Convite enviado para ${to}.` : `${to} já tinha conta e passou a administrador.`)
  })
  const remove = useAction(removeAdmin)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setDone(null)
    if (await invite.run(email.trim())) setEmail('')
  }

  return (
    <>
      <h1>Administradores</h1>
      <form className="card form" onSubmit={submit}>
        <label className="field" htmlFor="email">Convidar por email</label>
        <input id="email" type="email" required autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
        <p className="muted small">A pessoa recebe um email com uma ligação para escolher a palavra-passe e passa a ter acesso de administrador.</p>
        <ErrorNote error={invite.error} />
        {done && <p className="good" role="status">{done}</p>}
        <button className="btn" disabled={invite.busy}>{invite.busy ? 'A enviar…' : 'Enviar convite'}</button>
      </form>

      <ErrorNote error={remove.error} />
      <Async q={q}>
        {(rows) => (
          <ul className="list">
            {rows.map((a) => {
              const me = a.user_id === session?.user.id
              return (
                <li key={a.user_id} className="row">
                  <div className="row-main">
                    <div className="row-title">{a.email}{me && ' (você)'}</div>
                    {!me && (
                      <div className="row-actions">
                        <button
                          className="link danger"
                          disabled={remove.busy}
                          onClick={() => confirm(`Retirar o acesso de administrador a ${a.email}?`) && remove.run(a.user_id)}
                        >
                          Retirar acesso
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Async>
    </>
  )
}
