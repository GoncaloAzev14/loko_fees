import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import DebtChart from '../components/DebtChart'
import { FineList } from '../components/FineList'
import { ChevronLeftIcon, PlusIcon } from '../components/icons'
import { Async, Avatar } from '../components/ui'
import { useAuth } from '../lib/auth'
import { formatDate, money } from '../lib/format'
import { useBalances, useLedger, usePayments } from '../lib/hooks'
import type { Balance, FineStatus } from '../lib/types'

function headline(b: Balance) {
  if (b.credit > 0) return <>{b.name} tem <em>{money(b.credit)}</em> de crédito</>
  if (b.outstanding > 0) return <>{b.name} deve <em>{money(b.outstanding)}</em></>
  return <>{b.name} está <em>em dia</em></>
}

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
        const fineCount = ledger.data?.filter((r) => r.status !== 'cancelled').length
        return (
          <>
            <p><Link to="/players" className="actions"><ChevronLeftIcon className="ic sm" />Jogadores</Link></p>
            <p className="tag">Estado da conta</p>
            <h1>{headline(b)}</h1>
            {b.overdue > 0 && <p className="muted small" style={{ marginTop: -8 }}>{money(b.overdue)} fora do prazo</p>}

            <div className="card">
              <div className="profile">
                <Avatar name={b.name} />
                <div>
                  <div className="row-title">{b.name}</div>
                  <div className="row-sub">{b.role === 'staff' ? 'Equipa técnica' : 'Jogador'}{fineCount !== undefined && ` · ${fineCount} multas`}</div>
                </div>
                <div className="r"><small>Pago</small><b>{money(b.total_paid)}</b></div>
              </div>
            </div>

            {ledger.data && payments.data && <DebtChart fines={ledger.data} payments={payments.data} />}

            {isAdmin && (
              <div className="act">
                <Link className="cl" to={`/admin/payments?player=${id}`} aria-label="Registar pagamento"><PlusIcon /></Link>
                <div className="row-main">
                  <div className="row-title">Registar pagamento</div>
                  <div className="row-sub"><Link to={`/admin/fines/new?player=${id}`}>Adicionar multa</Link></div>
                </div>
              </div>
            )}

            <div className="chips" role="tablist" style={{ marginTop: 10 }}>
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
                          <div className="row-side amount good">+{money(p.amount)}</div>
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
