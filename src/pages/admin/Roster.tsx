import { useState, type FormEvent } from 'react'
import { Async, ErrorNote } from '../../components/ui'
import { deletePlayer, savePlayer } from '../../lib/api'
import { useAction, useBalances } from '../../lib/hooks'
import type { Balance, Role } from '../../lib/types'

/** The members of the club: players and staff. */
export default function Roster() {
  const q = useBalances()
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('player')
  const add = useAction(savePlayer)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (await add.run({ name: name.trim(), role, active: true })) setName('')
  }

  return (
    <>
      <h1>Plantel</h1>
      <form className="card form" onSubmit={submit}>
        <div className="grid2">
          <div>
            <label className="field" htmlFor="name">Nome</label>
            <input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="field" htmlFor="role">Função</label>
            <select id="role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="player">Jogador</option>
              <option value="staff">Equipa técnica</option>
            </select>
          </div>
        </div>
        <ErrorNote error={add.error} />
        <button className="btn" disabled={add.busy}>Adicionar</button>
      </form>
      <p className="muted small">Marque como inativo quem saiu do clube: deixa de aparecer ao registar multas, mas o histórico mantém-se. Só é possível apagar jogadores sem multas nem pagamentos, por exemplo depois de fechar a época.</p>
      <Async q={q}>{(rows) => <ul className="list">{rows.map((b) => <PlayerRow key={b.player_id} b={b} />)}</ul>}</Async>
    </>
  )
}

function PlayerRow({ b }: { b: Balance }) {
  const [name, setName] = useState(b.name)
  const [role, setRole] = useState<Role>(b.role)
  const [active, setActive] = useState(b.active)
  const save = useAction(savePlayer)
  const del = useAction(deletePlayer)
  const dirty = name.trim() !== b.name || role !== b.role || active !== b.active
  return (
    <li className="row edit">
      <input aria-label="Nome" value={name} onChange={(e) => setName(e.target.value)} />
      <select aria-label="Função" value={role} onChange={(e) => setRole(e.target.value as Role)}>
        <option value="player">Jogador</option>
        <option value="staff">Equipa técnica</option>
      </select>
      <label className="check"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Ativo</label>
      <button className="btn small" disabled={!dirty || !name.trim() || save.busy} onClick={() => save.run({ id: b.player_id, name: name.trim(), role, active })}>
        Guardar
      </button>
      <button
        className="link danger"
        disabled={del.busy}
        onClick={() => confirm(`Apagar ${b.name} definitivamente? Só é possível se não tiver multas nem pagamentos.`) && del.run(b.player_id)}
      >
        Apagar
      </button>
      <ErrorNote error={save.error ?? del.error} />
    </li>
  )
}
