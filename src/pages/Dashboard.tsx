import { Link, useNavigate } from 'react-router-dom'
import { AlertIcon, ArrowRightIcon, CheckIcon, SearchIcon, UsersIcon } from '../components/icons'
import { Async, Avatar, BalanceLine, BigMoney, PlayerSelect } from '../components/ui'
import { formatDate, money } from '../lib/format'
import { useBalances, useLedger, useLocalState, useSummary } from '../lib/hooks'
import type { Balance } from '../lib/types'

export default function Dashboard() {
  const summary = useSummary()
  const balances = useBalances()
  const [playerId, setPlayerId] = useLocalState('loko.player', '')
  const navigate = useNavigate()

  return (
    <>
      <p className="tag">Em caixa</p>
      <Async q={summary}>
        {(s) => (
          <>
            <BigMoney value={s.box} />
            <p className="muted small">Entradas {money(s.total_in)} · saídas {money(s.total_out)}</p>
          </>
        )}
      </Async>

      <Async q={balances}>
        {(list) => {
          const me = list.find((b) => b.player_id === playerId)
          const active = list.filter((b) => b.active)
          const debtors = active.filter((b) => b.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding)
          const overdue = active.filter((b) => b.overdue > 0)
          const credit = list.reduce((s, b) => s + b.credit, 0)
          const sum = (xs: Balance[], k: 'outstanding' | 'overdue') => xs.reduce((s, b) => s + b[k], 0)
          return (
            <>
              <div className="srch">
                <SearchIcon className="ic sm" />
                <PlayerSelect ariaLabel="Ver um jogador" balances={list} value={playerId} onChange={setPlayerId} placeholder="Ver um jogador" />
                <button className="go" disabled={!me} onClick={() => me && navigate(`/players/${me.player_id}`)}>Ver</button>
              </div>
              {me && <p className="me"><strong>{me.name}</strong>: <BalanceLine b={me} /></p>}

              <h2>Estado das dívidas</h2>
              <div className="trio">
                <div className="t3">
                  <div className="ring"><UsersIcon className="ic sm" /></div>
                  <b>{debtors.length}</b><span>Em dívida</span><small>{money(sum(debtors, 'outstanding'))}</small>
                </div>
                <div className="t3">
                  <div className="ring"><AlertIcon className="ic sm" /></div>
                  <b>{overdue.length}</b><span>Vencidos</span><small>{money(sum(overdue, 'overdue'))}</small>
                </div>
                <div className="t3">
                  <div className="ring"><CheckIcon className="ic sm" /></div>
                  <b>{active.length - debtors.length}</b><span>Em dia</span>
                  <small>{credit > 0 ? `${money(credit)} crédito` : ' '}</small>
                </div>
              </div>

              {debtors.length > 0 && (
                <>
                  <h2>Maior dívida</h2>
                  <TopDebt b={debtors[0]} />
                  {debtors.length > 1 && (
                    <>
                      <h2>Outras dívidas</h2>
                      <ul className="list">
                        {debtors.slice(1, 5).map((b) => (
                          <li key={b.player_id} className="row">
                            <Avatar name={b.name} />
                            <div className="row-main">
                              <Link className="row-title" to={`/players/${b.player_id}`}>{b.name}</Link>
                              {b.overdue > 0 && <div className="row-sub">{money(b.overdue)} vencido</div>}
                            </div>
                            <div className="row-side amount bad">{money(b.outstanding)}</div>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </>
              )}
            </>
          )
        }}
      </Async>
    </>
  )
}

/** The player who owes the most: the oldest open fine, the first deadline, how much is overdue. */
function TopDebt({ b }: { b: Balance }) {
  const ledger = useLedger({ playerId: b.player_id })
  const open = (ledger.data ?? []).filter((r) => r.status === 'pending' || r.status === 'overdue')
  const oldest = open.reduce<string | null>((m, r) => (m === null || r.fined_on < m ? r.fined_on : m), null)
  const due = open.reduce<string | null>((m, r) => (m === null || r.due_on < m ? r.due_on : m), null)
  return (
    <div className="card">
      <div className="card-head">
        <Link className="nm" to={`/players/${b.player_id}`}>{b.name}</Link>
        <div className="big">{money(b.outstanding)}</div>
      </div>
      <div className="route" aria-hidden="true">
        <span className="node f" /><i /><span className="tr"><ArrowRightIcon /></span><i /><span className="node" />
      </div>
      <div className="lab">
        <div>Multa mais antiga<b>{oldest ? formatDate(oldest) : '—'}</b></div>
        <div style={{ textAlign: 'right' }}>Primeiro prazo<b>{due ? formatDate(due) : '—'}</b></div>
      </div>
      <div className="foot">
        <div><small>Vencido</small><b>{money(b.overdue)}</b></div>
        <Link className="go" to={`/players/${b.player_id}`}>Ver detalhes</Link>
      </div>
    </div>
  )
}
