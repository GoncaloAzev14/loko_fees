import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FineList } from '../components/FineList'
import { Async, StatCard } from '../components/ui'
import { useAuth } from '../lib/auth'
import { formatDate, money } from '../lib/format'
import { useBalances, useLedger, usePayments } from '../lib/hooks'
import type { FineStatus } from '../lib/types'

export default function PlayerDetail() {
  const { id = '' } = useParams()
  const { isAdmin } = useAuth()
  const balances = useBalances()
  const ledger = useLedger({ playerId: id })
  const payments = usePayments(id)
  const [tab, setTab] = useState<'fines' | 'payments'>('fines')
  const [open, setOpen] = useState(true) // hide settled fines

  return (
    <Async q={balances}>
      {(list) => {
        const b = list.find((x) => x.player_id === id)
        if (!b) return <p className="muted pad">Jogador não encontrado. <Link to="/players">Voltar</Link></p>
        const hidden: FineStatus[] = ['paid', 'cancelled']
        return (
          <>
            <p><Link to="/players">‹ Jogadores</Link></p>
            <h1>{b.name}</h1>
            <div className="stats">
              <StatCard label="Em dívida" value={money(b.outstanding)} tone={b.outstanding > 0 ? 'bad' : undefined} hint={b.overdue > 0 ? `${money(b.overdue)} vencido` : undefined} />
              <StatCard label="Crédito" value={money(b.credit)} tone={b.credit > 0 ? 'good' : undefined} />
              <StatCard label="Total multado" value={money(b.total_fined)} />
              <StatCard label="Total pago" value={money(b.total_paid)} />
            </div>

            {isAdmin && (
              <p className="actions">
                <Link className="btn" to={`/admin/payments?player=${id}`}>Registar pagamento</Link>
                <Link className="btn secondary" to={`/admin/fines/new?player=${id}`}>Adicionar multa</Link>
              </p>
            )}

            <div className="chips" role="tablist">
              <button role="tab" aria-selected={tab === 'fines'} className={`chip ${tab === 'fines' ? 'on' : ''}`} onClick={() => setTab('fines')}>Multas</button>
              <button role="tab" aria-selected={tab === 'payments'} className={`chip ${tab === 'payments' ? 'on' : ''}`} onClick={() => setTab('payments')}>Pagamentos</button>
            </div>

            {tab === 'fines' ? (
              <Async q={ledger}>
                {(rows) => (
                  <>
                    <label className="check">
                      <input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} /> Só por pagar
                    </label>
                    <FineList showPlayer={false} rows={open ? rows.filter((r) => !hidden.includes(r.status)) : rows} />
                  </>
                )}
              </Async>
            ) : (
              <Async q={payments}>
                {(rows) =>
                  rows.length === 0 ? (
                    <p className="muted pad">Sem pagamentos registados.</p>
                  ) : (
                    <ul className="list">
                      {rows.map((p) => (
                        <li key={p.id} className="row">
                          <div className="row-main">
                            <div className="row-title">{formatDate(p.paid_on)}</div>
                            {p.note && <div className="row-sub">{p.note}</div>}
                          </div>
                          <div className="row-side amount good">{money(p.amount)}</div>
                        </li>
                      ))}
                    </ul>
                  )
                }
              </Async>
            )}
          </>
        )
      }}
    </Async>
  )
}
