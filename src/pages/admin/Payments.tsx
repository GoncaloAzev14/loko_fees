import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Async, BalanceLine, ErrorNote, PlayerSelect, SyncBadge } from '../../components/ui'
import { addPayment, deletePayment } from '../../lib/api'
import { formatDate, money, parseAmount, todayISO } from '../../lib/format'
import { useAction, useBalances, useLookups, usePayments, useQueuedEntries } from '../../lib/hooks'
import { withQueuedPayments } from '../../lib/overlay'

/** Record money received from a player. The form stays pinned while the list scrolls. */
export default function Payments() {
  const [params] = useSearchParams()
  const balances = useBalances()
  const payments = usePayments()
  const { players } = useLookups()
  const queued = useQueuedEntries()
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
      <div className="sticky-box form">
        <h1>Pagamentos</h1>
        <Async q={balances}>
          {(list) => {
            const b = list.find((x) => x.player_id === playerId)
            return (
              <form className="cf" onSubmit={submit}>
                <PlayerSelect ariaLabel="Jogador" required balances={list} value={playerId} onChange={setPlayerId} placeholder="Jogador" />
                {b && (
                  <p className="hint" style={{ margin: '0 2px' }}>
                    <BalanceLine b={b} />
                    {b.outstanding > 0 && (
                      <> · <button type="button" className="link" onClick={() => setAmount(String(b.outstanding).replace('.', ','))}>pagar tudo</button></>
                    )}
                  </p>
                )}
                <div className="cf-row">
                  <input className="narrow" aria-label="Valor (€)" placeholder="€" inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value)} />
                  <label className="field-inline">
                    <span>Data</span>
                    <input type="date" aria-label="Data" required value={date} onChange={(e) => setDate(e.target.value)} />
                  </label>
                </div>
                <div className="cf-row">
                  <input aria-label="Nota (opcional)" placeholder="Nota (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
                  <button className="cf-btn" disabled={save.busy}>{save.busy ? '…' : 'Registar'}</button>
                </div>
              </form>
            )
          }}
        </Async>
        <ErrorNote error={save.error} />
        {done && <p className="good form-msg" role="status">{done}</p>}
      </div>

      <h2>Últimos pagamentos</h2>
      <ErrorNote error={del.error} />
      <Async q={payments}>
        {(rows) => (
          <ul className="list">
            {withQueuedPayments(rows, queued).slice(0, 30).map((p) => (
              <li key={p.id} className={`row${p.sync ? ' waiting' : ''}`}>
                <div className="row-main">
                  <div className="row-title">{players.get(p.player_id)?.name ?? '…'}</div>
                  <div className="row-sub">
                    {formatDate(p.paid_on)}{p.note && ` · ${p.note}`}
                  </div>
                  {p.sync !== 'deleting' && (
                    <div className="row-actions">
                      <button className="link danger" disabled={del.busy} onClick={() => confirm('Apagar este pagamento?') && del.run(p.id)}>Apagar</button>
                    </div>
                  )}
                </div>
                <div className="row-side">
                  <div className="amount good">{money(p.amount)}</div>
                  {p.sync && <SyncBadge sync={p.sync} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Async>
    </>
  )
}
