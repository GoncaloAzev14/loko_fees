import { useState, type FormEvent } from 'react'
import { useConfirm } from '../../components/Confirm'
import { SendIcon, UserMinusIcon, XIcon } from '../../components/icons'
import IconButton from '../../components/IconButton'
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
  const inviteText = (status: string, to: string) =>
    status === 'invited' ? `Convite enviado para ${to}`
    : status === 'resent' ? `Enviámos um novo código a ${to}`
    : `${to} já é administrador`
  const invite = useAction(
    async (to: string) => {
      const status = await inviteAdmin(to)
      setDone(`${inviteText(status, to)}.`)
      return status
    },
    (status, to) => inviteText(String(status), to),
  )
  const remove = useAction(
    (userId: string, pending: boolean) => removeAdmin(userId).then(() => pending),
    (_r, _id, pending) => (pending ? 'Convite cancelado' : 'Acesso retirado'),
  )
  const ask = useConfirm()

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
        <p className="muted small">A pessoa recebe um email com uma ligação e um código. Só passa a administrador depois de escolher a palavra-passe ou entrar pela primeira vez.</p>
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
                    <div className="row-title">
                      {a.email}{me && ' (você)'}
                      {a.is_owner && <span className="badge owner">Principal</span>}
                      {a.pending && <span className="badge pending">Convite pendente</span>}
                    </div>
                    {!me && !a.is_owner && (
                      <div className="row-actions">
                        {a.pending && (
                          <IconButton Icon={SendIcon} label="Reenviar convite" disabled={invite.busy} onClick={() => { setDone(null); invite.run(a.email) }} />
                        )}
                        <IconButton
                          Icon={a.pending ? XIcon : UserMinusIcon} label={a.pending ? 'Cancelar convite' : 'Retirar acesso'} tone="danger" disabled={remove.busy}
                          onClick={async () => {
                            const yes = await ask(
                              a.pending
                                ? { title: 'Cancelar este convite?', message: `${a.email} deixa de poder usar o convite.`, confirmLabel: 'Cancelar convite', cancelLabel: 'Manter', tone: 'danger' }
                                : { title: 'Retirar o acesso?', message: `${a.email} deixa de ser administrador. Pode convidar de novo mais tarde.`, confirmLabel: 'Retirar acesso', tone: 'danger' },
                            )
                            if (yes) remove.run(a.user_id, a.pending === true)
                          }}
                        />
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
