import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useConfirm } from '../../components/Confirm'
import SaveStatus from '../../components/SaveStatus'
import { Async, BalanceLine, ErrorNote, PlayerSelect, SyncBadge } from '../../components/ui'
import { addPayment, deletePayment } from '../../lib/api'
import { formatDate, money, parseAmount, todayISO } from '../../lib/format'
import Folded from '../../components/Folded'
import { SearchIcon, TrashIcon, XIcon } from '../../components/icons'
import IconButton from '../../components/IconButton'
import { groupByMonth, matchesQuery } from '../../lib/paymentsView'
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
  const [filterPlayer, setFilterPlayer] = useState('') // which player's payments to list; empty = everyone
  const [query, setQuery] = useState('')
  const save = useAction(addPayment, (_r, p) => `Pagamento de ${money(p.amount)} registado`)
  const del = useAction(deletePayment, 'Pagamento apagado')
  const ask = useConfirm()

  async function submit(e: FormEvent) {
    e.preventDefault()
    const value = parseAmount(amount)
    if (!playerId || !(value > 0)) return
    if (await save.run({ player_id: playerId, amount: value, paid_on: date, note })) {
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
        <SaveStatus save={save.saved} />
      </div>

      <h2>Todos os pagamentos</h2>
      <div className="srch" style={{ marginBottom: 8 }}>
        <SearchIcon className="ic sm" />
        <input
          type="search" aria-label="Procurar pagamento (por jogador, nota, valor, data ou mês)" placeholder="Procurar…"
          value={query} onChange={(e) => setQuery(e.target.value)}
          style={{ border: 0, background: 'none', minHeight: 0, padding: 0, boxShadow: 'none' }}
        />
      </div>
      <Async q={balances}>
        {(list) => (
          <select aria-label="Filtrar por jogador" value={filterPlayer} onChange={(e) => setFilterPlayer(e.target.value)} style={{ marginBottom: 8 }}>
            <option value="">Todos os jogadores</option>
            {list.map((b) => <option key={b.player_id} value={b.player_id}>{b.name}</option>)}
          </select>
        )}
      </Async>
      <ErrorNote error={del.error} />
      <SaveStatus save={del.saved} />
      <Async q={payments}>
        {(rows) => {
          // the helper only filters what is waiting on the phone, so narrow the server's rows to the player first
          const ofPlayer = filterPlayer ? rows.filter((p) => p.player_id === filterPlayer) : rows
          const everyone = withQueuedPayments(ofPlayer, queued, filterPlayer || null)
          const label = (iso: string) => groupByMonth([{ amount: 0, paid_on: iso }], (r) => r.paid_on)[0].label
          const shown = everyone.filter((p) => matchesQuery(p, players.get(p.player_id)?.name ?? '', label(p.paid_on), formatDate(p.paid_on), query))
          const filtering = Boolean(query.trim() || filterPlayer)
          const clear = () => { setQuery(''); setFilterPlayer('') }
          if (everyone.length === 0 && !filtering) return <p className="muted pad">Ainda não há pagamentos.</p>
          const total = shown.reduce((sum, p) => sum + p.amount, 0)
          return (
            <>
              <p className="muted small" style={{ margin: '0 2px 8px', display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span>
                  {filtering ? `${shown.length} de ${everyone.length}` : shown.length} {shown.length === 1 ? 'pagamento' : 'pagamentos'} · {money(total)}
                </span>
                {filtering && <IconButton Icon={XIcon} label="Limpar pesquisa e filtro" onClick={clear} />}
              </p>
              {shown.length === 0 && <p className="muted pad">Nenhum pagamento encontrado.</p>}
              <Folded
                rows={shown} by="month" dateOf={(p) => p.paid_on} amountOf={(p) => p.amount} idPrefix="payments"
                filtering={filtering} resetKey={`${query}|${filterPlayer}`}
                render={(p) => (
                  <li key={p.id} className={`row${p.sync ? ' waiting' : ''}`}>
                    <div className="row-main">
                      <div className="row-title">{players.get(p.player_id)?.name ?? '…'}</div>
                      <div className="row-sub">
                        {formatDate(p.paid_on)}{p.note && ` · ${p.note}`}
                      </div>
                      {p.sync !== 'deleting' && (
                        <div className="row-actions">
                          <IconButton Icon={TrashIcon} label="Apagar pagamento" tone="danger" disabled={del.busy} onClick={async () => (await ask({ title: 'Apagar este pagamento?', message: 'Deixa de contar para o jogador e para a caixa. Pode repô-lo no Histórico.', confirmLabel: 'Apagar', tone: 'danger' })) && del.run(p.id)} />
                        </div>
                      )}
                    </div>
                    <div className="row-side">
                      <div className="amount good">{money(p.amount)}</div>
                      {p.sync && <SyncBadge sync={p.sync} />}
                    </div>
                  </li>
                )}
              />
            </>
          )
        }}
      </Async>
    </>
  )
}
