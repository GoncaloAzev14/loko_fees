import { useState, type FormEvent } from 'react'
import { useConfirm } from './Confirm'
import { PlusIcon } from './icons'
import { ErrorNote } from './ui'
import { deleteFineType, saveFineType } from '../lib/api'
import { parseAmount } from '../lib/format'
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

/** One fine type for an admin: change its name or value, switch it on or off (Ativo), or delete it. */
export function FineTypeRow({ t }: { t: FineType }) {
  const [name, setName] = useState(t.name)
  const [amount, setAmount] = useState(String(t.default_amount).replace('.', ','))
  const [active, setActive] = useState(t.active)
  const save = useAction(saveFineType, 'Tipo de multa guardado')
  const del = useAction(deleteFineType, 'Tipo de multa apagado')
  const ask = useConfirm()
  const value = parseAmount(amount)
  const dirty = name.trim() !== t.name || value !== t.default_amount || active !== t.active
  return (
    <li className="row edit">
      <input aria-label="Nome" value={name} onChange={(e) => setName(e.target.value)} />
      <input aria-label="Valor" className="narrow" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <label className="check"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Ativo</label>
      <button className="btn small" disabled={!dirty || !(value >= 0) || !name.trim() || save.busy} onClick={() => save.run({ id: t.id, name: name.trim(), default_amount: value, active })}>
        Guardar
      </button>
      <button
        className="link danger"
        disabled={del.busy}
        onClick={async () => (await ask({ title: `Apagar «${t.name}»?`, message: 'Só é possível se nenhuma multa o usar.', confirmLabel: 'Apagar', tone: 'danger' })) && del.run(t.id)}
      >
        Apagar
      </button>
      <ErrorNote error={save.error ?? del.error} />
    </li>
  )
}
