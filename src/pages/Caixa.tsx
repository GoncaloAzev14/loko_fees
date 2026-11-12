import { useMemo, useState } from 'react'
import { ArrowDownIcon, ArrowUpIcon, CoinIcon, PlusIcon } from '../components/icons'
import { Async, BigMoney } from '../components/ui'
import { formatDate, money } from '../lib/format'
import { useExpenses, useIncomes, useLookups, usePayments, useSummary } from '../lib/hooks'

type Filter = 'all' | 'in' | 'out'
interface Movement {
  key: string
  date: string
  title: string
  note?: string | null
  amount: number
  kind: 'payment' | 'income' | 'expense'
}

/** Everything that went into and out of the box. Open to everyone. */
export default function Caixa() {
  const summary = useSummary()
  const payments = usePayments()
  const incomes = useIncomes()
  const expenses = useExpenses()
  const { players } = useLookups()
  const [filter, setFilter] = useState<Filter>('all')

  const movements = useMemo<Movement[]>(() => {
    const name = (id: string | null) => (id ? players.get(id)?.name : undefined)
    const rows: Movement[] = [
      ...(payments.data ?? []).map((p) => ({
        key: `p${p.id}`, date: p.paid_on, kind: 'payment' as const, amount: p.amount, note: p.note,
        title: `Pagamento${name(p.player_id) ? ` · ${name(p.player_id)}` : ''}`,
      })),
      ...(incomes.data ?? []).map((i) => ({
        key: `i${i.id}`, date: i.received_on, kind: 'income' as const, amount: i.amount,
        title: `${i.description}${name(i.player_id) ? ` · ${name(i.player_id)}` : ''}`,
      })),
      ...(expenses.data ?? []).map((x) => ({
        key: `x${x.id}`, date: x.spent_on, kind: 'expense' as const, amount: -x.amount, title: x.description,
      })),
    ]
    return rows.sort((a, b) => b.date.localeCompare(a.date) || a.key.localeCompare(b.key))
  }, [payments.data, incomes.data, expenses.data, players])

  const loading = payments.isPending || incomes.isPending || expenses.isPending
  const failed = payments.isError || incomes.isError || expenses.isError
  const shown = movements.filter((m) => (filter === 'in' ? m.amount > 0 : filter === 'out' ? m.amount < 0 : true))

  return (
    <>
      <p className="tag">Caixa do clube</p>
      <Async q={summary}>
        {(s) => (
          <>
            <BigMoney value={s.box} />
            <div className="trio" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 14 }}>
              <div className="t3" style={{ textAlign: 'left', padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="ring" style={{ margin: 0, width: 28, height: 28 }}><ArrowDownIcon className="ic sm" /></span>
                  <span>Entradas</span>
                </div>
                <b style={{ marginTop: 8 }}>{money(s.total_in)}</b>
              </div>
              <div className="t3" style={{ textAlign: 'left', padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="ring" style={{ margin: 0, width: 28, height: 28 }}><ArrowUpIcon className="ic sm" /></span>
                  <span>Saídas</span>
                </div>
                <b style={{ marginTop: 8 }}>{money(s.total_out)}</b>
              </div>
            </div>
          </>
        )}
      </Async>

      <div className="chips" role="group" aria-label="Filtro" style={{ marginTop: 14 }}>
        {(['all', 'in', 'out'] as const).map((f) => (
          <button key={f} className={`chip ${filter === f ? 'on' : ''}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {{ all: 'Tudo', in: 'Entradas', out: 'Saídas' }[f]}
          </button>
        ))}
      </div>

      <h2>Movimentos</h2>
      {loading ? (
        <p className="muted pad">A carregar…</p>
      ) : failed ? (
        <p className="error pad" role="alert">Não foi possível carregar os movimentos.</p>
      ) : shown.length === 0 ? (
        <p className="muted pad">Sem movimentos.</p>
      ) : (
        <ul className="list">
          {shown.map((m) => (
            <li key={m.key} className="row">
              <span className="row-lead">
                {m.kind === 'payment' ? <CoinIcon className="ic sm" /> : m.kind === 'income' ? <PlusIcon className="ic sm" /> : <ArrowUpIcon className="ic sm" />}
              </span>
              <div className="row-main">
                <div className="row-title">{m.title}</div>
                <div className="row-sub">{formatDate(m.date)}{m.note && ` · ${m.note}`}</div>
              </div>
              <div className={`row-side amount${m.amount < 0 ? ' bad' : ''}`}>
                {m.amount > 0 ? '+' : '−'}{money(Math.abs(m.amount))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
