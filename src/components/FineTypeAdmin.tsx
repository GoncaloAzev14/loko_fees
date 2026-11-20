import { useState, type FormEvent } from 'react'
import { useConfirm } from './Confirm'
import { PlusIcon } from './icons'
import { ErrorNote } from './ui'
import { deleteFineType, saveFineType } from '../lib/api'
import { money, parseAmount } from '../lib/format'
import { useAction } from '../lib/hooks'
import type { FineType } from '../lib/types'

/** The form that adds a fine type. Only the Regulamento page shows it, and only to admins. */
export function AddFineType() {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const add = useAction(saveFineType, 'Tipo de multa adicionado')

  async function submit(e: FormEvent) {
    e.preventDefault()
    const value = parseAmount(amount)
    if (!(value >= 0) || !name.trim()) return
    if (await add.run({ name: name.trim(), default_amount: value })) {
      setName('')
      setAmount('')
    }
  }

  return (
    <>
      <form className="cf-row" onSubmit={submit}>
        <input aria-label="Nome" placeholder="Nome" required value={name} onChange={(e) => setName(e.target.value)} />
        <input className="narrow" aria-label="Valor (€)" placeholder="€" inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value)} />
        <button className="cf-add" aria-label="Adicionar" disabled={add.busy}><PlusIcon /></button>
      </form>
      <ErrorNote error={add.error} />
    </>
  )
}

/**
 * One fine type for an admin. It looks like the card visitors see (name on the left, value on the right) with
 * the admin's tools tucked under it: an Ativa switch, Editar and Apagar. Editar turns the card into a small form.
 */
export function FineTypeRow({ t }: { t: FineType }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(t.name)
  const [amount, setAmount] = useState(String(t.default_amount).replace('.', ','))
  const toggle = useAction(saveFineType, (_r, p) => (p.active ? 'Multa ativada' : 'Multa desativada'))
  const save = useAction(saveFineType, 'Tipo de multa guardado')
  const del = useAction(deleteFineType, 'Tipo de multa apagado')
  const ask = useConfirm()
  const value = parseAmount(amount)
  const changed = name.trim() !== t.name || value !== t.default_amount
  const valid = value >= 0 && name.trim() !== ''

  function startEditing() {
    setName(t.name)
    setAmount(String(t.default_amount).replace('.', ','))
    setEditing(true)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid || !changed) return setEditing(false)
    if (await save.run({ id: t.id, name: name.trim(), default_amount: value, active: t.active })) setEditing(false)
  }

  if (editing)
    return (
      <li className="row editing">
        <form onSubmit={submit}>
          <div className="cf-row">
            <input aria-label="Nome" value={name} autoFocus onChange={(e) => setName(e.target.value)} />
            <input className="narrow" aria-label="Valor (€)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="row-actions">
            <button className="btn small" disabled={!valid || !changed || save.busy}>Guardar</button>
            <button type="button" className="link" onClick={() => setEditing(false)}>Cancelar</button>
          </div>
          <ErrorNote error={save.error} />
        </form>
      </li>
    )

  return (
    <li className={`row${t.active ? '' : ' inactive'}`}>
      <div className="row-main">
        <div className="row-title">
          {t.name}
          {!t.active && <span className="badge pending-off">Desativada</span>}
        </div>
        <div className="row-actions">
          <button className="link" onClick={startEditing}>Editar</button>
          <button
            className="link danger"
            disabled={del.busy}
            onClick={async () => (await ask({ title: `Apagar «${t.name}»?`, message: 'Só é possível se nenhuma multa a usar.', confirmLabel: 'Apagar', tone: 'danger' })) && del.run(t.id)}
          >
            Apagar
          </button>
        </div>
        <ErrorNote error={toggle.error ?? del.error} />
      </div>
      <div className="row-side">
        <div className="amount">{money(t.default_amount)}</div>
        <button
          type="button" role="switch" aria-checked={t.active} className="switch" disabled={toggle.busy}
          onClick={() => toggle.run({ id: t.id, name: t.name, default_amount: t.default_amount, active: !t.active })}
        >
          <span className="track" aria-hidden="true" />
          Ativa
        </button>
      </div>
    </li>
  )
}
