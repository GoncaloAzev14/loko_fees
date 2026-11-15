import { useMemo, useState } from 'react'
import { ArrowDownIcon, ArrowUpIcon, CoinIcon, PlusIcon, TouchIcon } from '../components/icons'
import { Async, BigMoney, SyncBadge } from '../components/ui'
import { formatDate, money } from '../lib/format'
import { useExpenses, useIncomes, useLookups, usePayments, useQueuedEntries, useSummary } from '../lib/hooks'
import { withQueuedExpenses, withQueuedIncomes, withQueuedPayments } from '../lib/overlay'
import type { SyncMark } from '../lib/types'

type Filter = 'all' | 'in' | 'out'
interface Movement {
  key: string
  date: string
  title: string
  note?: string | null
  amount: number
  kind: 'payment' | 'income' | 'expense'
  sync?: SyncMark
}

/** Everything that went into and out of the box. Open to everyone. */
export default function Caixa() {
  const summary = useSummary()
  const payments = usePayments()
  const incomes = useIncomes()
  const expenses = useExpenses()
  const { players } = useLookups()
  const queued = useQueuedEntries()
  const [filter, setFilter] = useState<Filter>('all')

  const movements = useMemo<Movement[]>(() => {
    const name = (id: string | null) => (id ? players.get(id)?.name : undefined)
    const rows: Movement[] = [
      ...withQueuedPayments(payments.data ?? [], queued).map((p) => ({
        key: `p${p.id}`, date: p.paid_on, kind: 'payment' as const, amount: p.amount, note: p.note, sync: p.sync,
        title: `Pagamento${name(p.player_id) ? ` · ${name(p.player_id)}` : ''}`,
      })),
      ...withQueuedIncomes(incomes.data ?? [], queued).map((i) => ({
        key: `i${i.id}`, date: i.received_on, kind: 'income' as const, amount: i.amount, sync: i.sync,
        title: `${i.description}${name(i.player_id) ? ` · ${name(i.player_id)}` : ''}`,
      })),
      ...withQueuedExpenses(expenses.data ?? [], queued).map((x) => ({
        key: `x${x.id}`, date: x.spent_on, kind: 'expense' as const, amount: -x.amount, title: x.description, sync: x.sync,
      })),
    ]
    return rows.sort((a, b) => b.date.localeCompare(a.date) || a.key.localeCompare(b.key))
  }, [payments.data, incomes.data, expenses.data, players, queued])

  const loading = payments.isPending || incomes.isPending || expenses.isPending
  const failed = payments.isError || incomes.isError || expenses.isError
  const shown = movements.filter((m) => (filter === 'in' ? m.amount > 0 : filter === 'out' ? m.amount < 0 : true))

  return (
    <>
      <div className="sticky-box compact">
        <p className="tag">Caixa do clube</p>
        <Async q={summary}>
          {(s) => (
            <>
              <BigMoney value={s.box} />
              <div className="statbtns">
                <button className="statbtn" aria-pressed={filter === 'in'} onClick={() => setFilter(filter === 'in' ? 'all' : 'in')}>
                  <span className="ring"><ArrowDownIcon className="ic sm" /></span>
                  <span><small>Entradas</small><b>{money(s.total_in)}</b></span>
                  <TouchIcon className="ic touch" />
                </button>
                <button className="statbtn" aria-pressed={filter === 'out'} onClick={() => setFilter(filter === 'out' ? 'all' : 'out')}>
                  <span className="ring"><ArrowUpIcon className="ic sm" /></span>
                  <span><small>Saídas</small><b>{money(s.total_out)}</b></span>
                  <TouchIcon className="ic touch" />
                </button>
              </div>
            </>
          )}
        </Async>
      </div>

      <h2>Movimentos{filter !== 'all' && <span className="muted"> · {filter === 'in' ? 'só entradas' : 'só saídas'}</span>}</h2>
      {loading ? (
        <p className="muted pad">A carregar…</p>
      ) : failed ? (
        <p className="error pad" role="alert">Não foi possível carregar os movimentos.</p>
      ) : shown.length === 0 ? (
        <p className="muted pad">Sem movimentos.</p>
      ) : (
        <ul className="list">
          {shown.map((m) => (
            <li key={m.key} className={`row${m.sync ? ' waiting' : ''}`}>
              <span className="row-lead">
                {m.kind === 'payment' ? <CoinIcon className="ic sm" /> : m.kind === 'income' ? <PlusIcon className="ic sm" /> : <ArrowUpIcon className="ic sm" />}
              </span>
              <div className="row-main">
                <div className="row-title">{m.title}</div>
                <div className="row-sub">{formatDate(m.date)}{m.note && ` · ${m.note}`}</div>
              </div>
              <div className="row-side">
                <div className={`amount${m.amount < 0 ? ' bad' : ''}`}>{m.amount > 0 ? '+' : '−'}{money(Math.abs(m.amount))}</div>
                {m.sync && <SyncBadge sync={m.sync} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
