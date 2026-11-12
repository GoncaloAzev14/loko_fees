import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Async, BalanceLine, ErrorNote, PlayerSelect } from '../../components/ui'
import { addPayment, deletePayment } from '../../lib/api'
import { formatDate, money, parseAmount, todayISO } from '../../lib/format'
import { useAction, useBalances, useLookups, usePayments } from '../../lib/hooks'

/** Record money received from a player. It settles their oldest fines first; any surplus is credit. */
export default function Payments() {
  const [params] = useSearchParams()
  const balances = useBalances()
  const payments = usePayments()
  const { players } = useLookups()
  const [playerId, setPlayerId] = useState(params.get('player') ?? '')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const save = useAction(addPayment)
  const del = useAction(deletePayment)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setDone(null)
    const value = parseAmount(amount)
    if (!playerId || !(value > 0)) return
    if (await save.run({ player_id: playerId, amount: value, paid_on: date, note })) {
      setDone(`Pagamento de ${money(value)} registado.`)
      setAmount('')
      setNote('')
    }
  }

  return (
    <>
      <h1>Pagamentos</h1>
      <Async q={balances}>
        {(list) => {
          const b = list.find((x) => x.player_id === playerId)
          return (
            <form className="card form" onSubmit={submit}>
              <label className="field" htmlFor="player">Jogador</label>
              <PlayerSelect id="player" required balances={list} value={playerId} onChange={setPlayerId} placeholder="Escolher…" />
              {b && (
                <p className="hint">
                  <BalanceLine b={b} />
                  {b.outstanding > 0 && (
                    <> · <button type="button" className="link" onClick={() => setAmount(String(b.outstanding).replace('.', ','))}>pagar tudo</button></>
                  )}
                </p>
              )}
              <div className="grid2">
                <div>
                  <label className="field" htmlFor="amount">Valor (€)</label>
                  <input id="amount" inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <div>
                  <label className="field" htmlFor="date">Data</label>
                  <input id="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
              </div>
              <label className="field" htmlFor="note">Nota (opcional)</label>
              <input id="note" value={note} onChange={(e) => setNote(e.target.value)} />
              <p className="muted small">Cobre primeiro as multas mais antigas; o que sobrar fica como crédito.</p>
              <ErrorNote error={save.error} />
              {done && <p className="good" role="status">{done}</p>}
              <button className="btn" disabled={save.busy}>{save.busy ? 'A guardar…' : 'Registar pagamento'}</button>
            </form>
          )
        }}
      </Async>

      <h2>Últimos pagamentos</h2>
      <ErrorNote error={del.error} />
      <Async q={payments}>
        {(rows) => (
          <ul className="list">
            {rows.slice(0, 30).map((p) => (
              <li key={p.id} className="row">
                <div className="row-main">
                  <div className="row-title">{players.get(p.player_id)?.name ?? '…'}</div>
                  <div className="row-sub">
                    {formatDate(p.paid_on)}{p.note && ` · ${p.note}`}
                  </div>
                  <div className="row-actions">
                    <button className="link danger" disabled={del.busy} onClick={() => confirm('Apagar este pagamento?') && del.run(p.id)}>Apagar</button>
                  </div>
                </div>
                <div className="row-side amount good">{money(p.amount)}</div>
              </li>
            ))}
          </ul>
        )}
      </Async>
    </>
  )
}
