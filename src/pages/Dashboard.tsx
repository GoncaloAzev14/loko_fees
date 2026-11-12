import { Link } from 'react-router-dom'
import { Async, BalanceLine, PlayerSelect, StatCard } from '../components/ui'
import { money } from '../lib/format'
import { useBalances, useLocalState, useSummary } from '../lib/hooks'

export default function Dashboard() {
  const summary = useSummary()
  const balances = useBalances()
  const [playerId, setPlayerId] = useLocalState('loko.player', '')

  return (
    <>
      <h1>Caixa</h1>
      <Async q={summary}>
        {(s) => (
          <div className="stats">
            <StatCard label="Em caixa" value={money(s.box)} tone="good" hint={`Entradas ${money(s.total_in)} · saídas ${money(s.total_out)}`} />
            <StatCard label="Em dívida" value={money(s.total_outstanding)} tone={s.total_outstanding > 0 ? 'bad' : undefined} hint="Total por pagar pelo plantel" />
            <StatCard label="Vencido" value={money(s.total_overdue)} tone={s.total_overdue > 0 ? 'warn' : undefined} hint="Fora do prazo de pagamento" />
            <StatCard label="Em crédito" value={money(s.total_credit)} hint="Pago a mais por jogadores" />
          </div>
        )}
      </Async>

      <Async q={balances}>
        {(list) => {
          const me = list.find((b) => b.player_id === playerId)
          const top = list.filter((b) => b.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding).slice(0, 5)
          return (
            <>
              <section className="card">
                <h2>Ver um jogador</h2>
                <label className="field" htmlFor="me">Jogador</label>
                <PlayerSelect id="me" balances={list} value={playerId} onChange={setPlayerId} placeholder="Escolher…" />
                {me && (
                  <p className="me">
                    <strong>{me.name}</strong>: <BalanceLine b={me} />
                    <br />
                    <Link to={`/players/${me.player_id}`}>Ver multas e pagamentos ›</Link>
                  </p>
                )}
              </section>

              {top.length > 0 && (
                <section>
                  <h2>Maiores dívidas</h2>
                  <ul className="list">
                    {top.map((b) => (
                      <li key={b.player_id} className="row">
                        <div className="row-main">
                          <Link className="row-title" to={`/players/${b.player_id}`}>{b.name}</Link>
                          {b.overdue > 0 && <div className="row-sub">{money(b.overdue)} vencido</div>}
                        </div>
                        <div className="row-side amount bad">{money(b.outstanding)}</div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )
        }}
      </Async>
    </>
  )
}
