import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useConfirm } from './Confirm'
import { CheckIcon, PencilIcon, PlusIcon, TrashIcon, XIcon } from './icons'
import IconButton from './IconButton'
import { Avatar, ErrorNote } from './ui'
import { deletePlayer, savePlayer } from '../lib/api'
import { money } from '../lib/format'
import { useAction } from '../lib/hooks'
import type { Balance, Role } from '../lib/types'

const ROLE_LABEL: Record<Role, string> = { player: 'Jogador', staff: 'Equipa técnica' }

function RoleSelect({ value, onChange, className }: { value: Role; onChange: (r: Role) => void; className?: string }) {
  return (
    <select className={className} aria-label="Função" value={value} onChange={(e) => onChange(e.target.value as Role)}>
      <option value="player">{ROLE_LABEL.player}</option>
      <option value="staff">{ROLE_LABEL.staff}</option>
    </select>
  )
}

/** The form that adds a player or a member of the staff. Only the Plantel page shows it, and only to admins. */
export function AddPlayer() {
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('player')
  const add = useAction(savePlayer, 'Jogador adicionado')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    if (await add.run({ name: name.trim(), role, active: true })) setName('')
  }

  return (
    <>
      <form className="cf-row" onSubmit={submit}>
        <input aria-label="Nome" placeholder="Nome" required value={name} onChange={(e) => setName(e.target.value)} />
        <RoleSelect className="role-wide" value={role} onChange={setRole} />
        <button className="cf-add" aria-label="Adicionar" disabled={add.busy}><PlusIcon /></button>
      </form>
      <ErrorNote error={add.error} />
    </>
  )
}

/**
 * One member on the Plantel page. Everyone gets the card (name, function, what they owe or have in credit) that
 * opens the member's page. An admin also gets the tools under it: an Ativo switch that saves at once, Editar
 * (name and function) and Apagar.
 */
export function PlayerCard({ b, admin }: { b: Balance; admin: boolean }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(b.name)
  const [role, setRole] = useState<Role>(b.role)
  const toggle = useAction(savePlayer, (_r, p) => (p.active ? 'Jogador ativado' : 'Jogador desativado'))
  const save = useAction(savePlayer, 'Jogador guardado')
  const del = useAction(deletePlayer, 'Jogador apagado')
  const ask = useConfirm()
  const changed = name.trim() !== b.name || role !== b.role

  function startEditing() {
    setName(b.name)
    setRole(b.role)
    setEditing(true)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || !changed) return setEditing(false)
    if (await save.run({ id: b.player_id, name: name.trim(), role, active: b.active })) setEditing(false)
  }

  if (admin && editing)
    return (
      <li className="row editing">
        <form onSubmit={submit}>
          <div className="cf-row">
            <input aria-label="Nome" value={name} autoFocus onChange={(e) => setName(e.target.value)} />
            <RoleSelect className="role-wide" value={role} onChange={setRole} />
          </div>
          <div className="row-actions">
            <IconButton Icon={CheckIcon} label="Guardar" tone="solid" type="submit" disabled={!name.trim() || !changed || save.busy} />
            <IconButton Icon={XIcon} label="Cancelar" onClick={() => setEditing(false)} />
          </div>
          <ErrorNote error={save.error} />
        </form>
      </li>
    )

  return (
    <li className={`row clickable${b.active ? '' : ' inactive'}`}>
      <Avatar name={b.name} />
      <div className="row-main">
        <Link className="row-title" to={`/players/${b.player_id}`}>{b.name}</Link>
        <div className="row-sub">
          {ROLE_LABEL[b.role]}
          {!b.active && ' · inativo'}
          {b.overdue > 0 && ` · ${money(b.overdue)} vencido`}
        </div>
        {admin && (
          <div className="row-actions">
            <IconButton Icon={PencilIcon} label={`Editar ${b.name}`} onClick={startEditing} />
            <IconButton
              Icon={TrashIcon} label={`Apagar ${b.name}`} tone="danger" disabled={del.busy}
              onClick={async () => (await ask({ title: `Apagar ${b.name}?`, message: 'Só é possível se não tiver multas nem pagamentos.', confirmLabel: 'Apagar', tone: 'danger' })) && del.run(b.player_id)}
            />
          </div>
        )}
        {admin && <ErrorNote error={toggle.error ?? del.error} />}
      </div>
      <div className="row-side">
        {b.credit > 0 ? (
          <span className="amount good">Crédito {money(b.credit)}</span>
        ) : b.outstanding > 0 ? (
          <span className="amount bad">{money(b.outstanding)}</span>
        ) : (
          <span className="muted small">Sem dívidas</span>
        )}
        {admin && (
          <button
            type="button" role="switch" aria-checked={b.active} className="switch" disabled={toggle.busy}
            onClick={() => toggle.run({ id: b.player_id, name: b.name, role: b.role, active: !b.active })}
          >
            <span className="track" aria-hidden="true" />
            Ativo
          </button>
        )}
      </div>
    </li>
  )
}
