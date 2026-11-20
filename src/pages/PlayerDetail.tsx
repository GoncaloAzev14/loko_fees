import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import DebtChart from '../components/DebtChart'
import Folded from '../components/Folded'
import { FineList } from '../components/FineList'
import { ChevronLeftIcon, PlusIcon } from '../components/icons'
import { Async, Avatar, SyncBadge } from '../components/ui'
import { useAuth } from '../lib/auth'
import { formatDate, money } from '../lib/format'
import { payMethodLabel } from '../lib/labels'
import { useBalances, useIncomes, useLedger, usePayments, useQueuedEntries } from '../lib/hooks'
import { withQueuedFines, withQueuedIncomes, withQueuedPayments } from '../lib/overlay'
import type { Balance, FineStatus, LedgerRow } from '../lib/types'

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
  const incomes = useIncomes()
  const queued = useQueuedEntries()
  const [chosen, setTab] = useState<'fines' | 'payments' | 'donations'>('fines')
  const [open, setOpen] = useState(true) // hide settled fines

  return (
    <Async q={balances}>
      {(list) => {
        const b = list.find((x) => x.player_id === id)
        if (!b) return <p className="muted pad">Jogador não encontrado. <Link to="/players">Voltar</Link></p>
        const hidden: FineStatus[] = ['paid', 'cancelled']
        const fineCount = ledger.data?.filter((r) => r.status !== 'cancelled').length
        // money this member gave the club (prizes, donations, gifts), recorded by an admin under Receitas
        const donations = withQueuedIncomes(incomes.data ?? [], queued).filter((i) => i.player_id === id)
        const tab = chosen === 'donations' && donations.length === 0 ? 'fines' : chosen // the tab goes away if the last one is deleted
        const shownFines = (rows: LedgerRow[]) => withQueuedFines(rows, queued, { playerId: id }) // plus what is waiting to be sent
        return (
          <>
            <p><Link to="/players" className="actions"><ChevronLeftIcon className="ic sm" />Plantel</Link></p>
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
              {donations.length > 0 && (
                <button role="tab" aria-selected={tab === 'donations'} className={`chip ${tab === 'donations' ? 'on' : ''}`} onClick={() => setTab('donations')}>Donativos</button>
              )}
            </div>

            {tab === 'fines' ? (
              <Async q={ledger}>
                {(rows) => (
                  <>
                    <label className="check">
                      <input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} /> Só por pagar
                    </label>
                    <FineList showPlayer={false} groupBy="month" resetKey={String(open)} rows={open ? shownFines(rows).filter((r) => !hidden.includes(r.status)) : shownFines(rows)} />
                  </>
                )}
              </Async>
            ) : tab === 'donations' ? (
              <Folded
                rows={donations} by="month" dateOf={(i) => i.received_on} amountOf={(i) => i.amount} idPrefix="player-donations"
                noun={['donativo', 'donativos']}
                render={(i) => (
                  <li key={i.id} className={`row${i.sync ? ' waiting' : ''}`}>
                    <div className="row-main">
                      <div className="row-title">{i.description}</div>
                      <div className="row-sub">{formatDate(i.received_on)}</div>
                    </div>
                    <div className="row-side">
                      <div className="amount good">+{money(i.amount)}</div>
                      {i.sync && <SyncBadge sync={i.sync} />}
                    </div>
                  </li>
                )}
              />
            ) : (
              <Async q={payments}>
                {(serverRows) => {
                  const rows = withQueuedPayments(serverRows, queued, id)
                  return rows.length === 0 ? (
                    <p className="muted pad">Sem pagamentos registados.</p>
                  ) : (
                    <Folded
                      rows={rows} by="month" dateOf={(p) => p.paid_on} amountOf={(p) => p.amount} idPrefix="player-payments"
                      noun={['pagamento', 'pagamentos']}
                      render={(p) => (
                        <li key={p.id} className={`row${p.sync ? ' waiting' : ''}`}>
                          <div className="row-main">
                            <div className="row-title">{formatDate(p.paid_on)}</div>
                            {(p.method || p.note) && <div className="row-sub">{[payMethodLabel(p.method), p.note].filter(Boolean).join(' · ')}</div>}
                          </div>
                          <div className="row-side">
                            <div className="amount good">+{money(p.amount)}</div>
                            {p.sync && <SyncBadge sync={p.sync} />}
                          </div>
                        </li>
                      )}
                    />
                  )
                }}
              </Async>
            )}
          </>
        )
      }}
    </Async>
  )
}
