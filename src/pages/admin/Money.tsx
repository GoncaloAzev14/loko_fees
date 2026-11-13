import { useState, type FormEvent } from 'react'
import { PlusIcon } from '../../components/icons'
import { Async, ErrorNote } from '../../components/ui'
import { addExpense, addIncome, deleteExpense, deleteIncome } from '../../lib/api'
import { formatDate, money, parseAmount, todayISO } from '../../lib/format'
import { useAction, useBalances, useExpenses, useIncomes, useLookups } from '../../lib/hooks'

type Kind = 'in' | 'out'

/**
 * Money that is not a player's debt (prizes, donations) and money out of the box.
 * One pinned form, switched between the two kinds; the matching list scrolls below it.
 */
export default function Money() {
  const [kind, setKind] = useState<Kind>('in')
  return (
    <>
      <div className="sticky-box form">
        <div className="seg2" role="tablist" aria-label="Tipo">
          <button role="tab" aria-selected={kind === 'in'} onClick={() => setKind('in')}>Receitas</button>
          <button role="tab" aria-selected={kind === 'out'} onClick={() => setKind('out')}>Despesas</button>
        </div>
        {kind === 'in' ? <IncomeForm /> : <ExpenseForm />}
      </div>
      {kind === 'in' ? <IncomeList /> : <ExpenseList />}
    </>
  )
}

function IncomeForm() {
  const balances = useBalances()
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [playerId, setPlayerId] = useState('')
  const save = useAction(addIncome)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const value = parseAmount(amount)
    if (!(value > 0)) return
    if (await save.run({ description: description.trim(), amount: value, received_on: date, player_id: playerId || null })) {
      setDescription('')
      setAmount('')
    }
  }

  return (
    <form className="cf" onSubmit={submit}>
      <input aria-label="Descrição" placeholder="Descrição (ex.: prémio de vitória)" required value={description} onChange={(e) => setDescription(e.target.value)} />
      <div className="cf-row">
        <input className="narrow" aria-label="Valor (€)" placeholder="€" inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value)} />
        <label className="field-inline">
          <span>Data</span>
          <input type="date" aria-label="Data" required value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
      <div className="cf-row">
        <select aria-label="Origem" value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
          <option value="">Origem (opcional)</option>
          {balances.data?.map((b) => <option key={b.player_id} value={b.player_id}>{b.name}</option>)}
        </select>
        <button className="cf-add" aria-label="Adicionar receita" disabled={save.busy}><PlusIcon /></button>
      </div>
      <ErrorNote error={save.error} />
    </form>
  )
}

function ExpenseForm() {
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const save = useAction(addExpense)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const value = parseAmount(amount)
    if (!(value > 0)) return
    if (await save.run({ description: description.trim(), amount: value, spent_on: date })) {
      setDescription('')
      setAmount('')
    }
  }

  return (
    <form className="cf" onSubmit={submit}>
      <input aria-label="Descrição" placeholder="Descrição (ex.: jantar de equipa)" required value={description} onChange={(e) => setDescription(e.target.value)} />
      <div className="cf-row">
        <input className="narrow" aria-label="Valor (€)" placeholder="€" inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value)} />
        <label className="field-inline">
          <span>Data</span>
          <input type="date" aria-label="Data" required value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <button className="cf-add" aria-label="Adicionar despesa" disabled={save.busy}><PlusIcon /></button>
      </div>
      <ErrorNote error={save.error} />
    </form>
  )
}

function IncomeList() {
  const q = useIncomes()
  const { players } = useLookups()
  const del = useAction(deleteIncome)
  return (
    <>
      <ErrorNote error={del.error} />
      <Async q={q}>
        {(rows) =>
          rows.length === 0 ? (
            <p className="empty">Ainda não há receitas.</p>
          ) : (
            <ul className="list">
              {rows.map((i) => (
                <li key={i.id} className="row">
                  <div className="row-main">
                    <div className="row-title">{i.description}</div>
                    <div className="row-sub">{formatDate(i.received_on)}{i.player_id && ` · ${players.get(i.player_id)?.name ?? ''}`}</div>
                    <div className="row-actions">
                      <button className="link danger" onClick={() => confirm('Apagar esta receita?') && del.run(i.id)}>Apagar</button>
                    </div>
                  </div>
                  <div className="row-side amount good">+{money(i.amount)}</div>
                </li>
              ))}
            </ul>
          )
        }
      </Async>
    </>
  )
}

function ExpenseList() {
  const q = useExpenses()
  const del = useAction(deleteExpense)
  return (
    <>
      <ErrorNote error={del.error} />
      <Async q={q}>
        {(rows) =>
          rows.length === 0 ? (
            <p className="empty">Ainda não há despesas.</p>
          ) : (
            <ul className="list">
              {rows.map((x) => (
                <li key={x.id} className="row">
                  <div className="row-main">
                    <div className="row-title">{x.description}</div>
                    <div className="row-sub">{formatDate(x.spent_on)}</div>
                    <div className="row-actions">
                      <button className="link danger" onClick={() => confirm('Apagar esta despesa?') && del.run(x.id)}>Apagar</button>
                    </div>
                  </div>
                  <div className="row-side amount bad">−{money(x.amount)}</div>
                </li>
              ))}
            </ul>
          )
        }
      </Async>
    </>
  )
}
