import { useState, type FormEvent } from 'react'
import { Async, ErrorNote } from '../../components/ui'
import { addExpense, addIncome, deleteExpense, deleteIncome } from '../../lib/api'
import { formatDate, money, parseAmount, todayISO } from '../../lib/format'
import { useAction, useBalances, useExpenses, useIncomes, useLookups } from '../../lib/hooks'

/** Money in that is not a player's debt (prizes, donations) and money out of the box. */
export default function Money() {
  return (
    <>
      <h1>Receitas e despesas</h1>
      <Incomes />
      <Expenses />
    </>
  )
}

function Incomes() {
  const q = useIncomes()
  const balances = useBalances()
  const { players } = useLookups()
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [playerId, setPlayerId] = useState('')
  const save = useAction(addIncome)
  const del = useAction(deleteIncome)

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
    <section>
      <h2>Receitas</h2>
      <form className="card form" onSubmit={submit}>
        <label className="field" htmlFor="idesc">Descrição</label>
        <input id="idesc" required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Prémio de vitória…" />
        <div className="grid2">
          <div>
            <label className="field" htmlFor="iamount">Valor (€)</label>
            <input id="iamount" inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="field" htmlFor="idate">Data</label>
            <input id="idate" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <label className="field" htmlFor="iplayer">Origem (opcional)</label>
        <Async q={balances}>
          {(list) => (
            <select id="iplayer" value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
              <option value="">—</option>
              {list.map((b) => <option key={b.player_id} value={b.player_id}>{b.name}</option>)}
            </select>
          )}
        </Async>
        <ErrorNote error={save.error ?? del.error} />
        <button className="btn" disabled={save.busy}>Adicionar receita</button>
      </form>
      <Async q={q}>
        {(rows) => (
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
                <div className="row-side amount good">{money(i.amount)}</div>
              </li>
            ))}
          </ul>
        )}
      </Async>
    </section>
  )
}

function Expenses() {
  const q = useExpenses()
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const save = useAction(addExpense)
  const del = useAction(deleteExpense)

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
    <section>
      <h2>Despesas</h2>
      <form className="card form" onSubmit={submit}>
        <label className="field" htmlFor="edesc">Descrição</label>
        <input id="edesc" required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Jantar de equipa…" />
        <div className="grid2">
          <div>
            <label className="field" htmlFor="eamount">Valor (€)</label>
            <input id="eamount" inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="field" htmlFor="edate">Data</label>
            <input id="edate" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <ErrorNote error={save.error ?? del.error} />
        <button className="btn" disabled={save.busy}>Adicionar despesa</button>
      </form>
      <Async q={q}>
        {(rows) => (
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
        )}
      </Async>
    </section>
  )
}
