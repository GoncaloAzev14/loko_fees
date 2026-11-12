import { useMemo, useState } from 'react'
import { FineList } from '../components/FineList'
import { Async, PlayerSelect } from '../components/ui'
import { money, monthRange } from '../lib/format'
import { STATUS_LABEL } from '../lib/labels'
import { useBalances, useFineTypes, useLedger } from '../lib/hooks'
import type { FineStatus } from '../lib/types'

/** Who got fined, when and why. Filter by dates, player, type and status. */
export default function Fines() {
  const [range, setRange] = useState(() => monthRange(0))
  const [playerId, setPlayerId] = useState('')
  const [fineTypeId, setFineTypeId] = useState('')
  const [status, setStatus] = useState<FineStatus | ''>('')
  const balances = useBalances()
  const types = useFineTypes()
  const filter = useMemo(
    () => ({
      from: range.from || undefined,
      to: range.to || undefined,
      playerId: playerId || undefined,
      fineTypeId: fineTypeId || undefined,
      status: status || undefined,
    }),
    [range, playerId, fineTypeId, status],
  )
  const ledger = useLedger(filter)

  return (
    <>
      <h1>Multas</h1>
      <div className="chips" role="group" aria-label="Período">
        <button className="chip" onClick={() => setRange(monthRange(0))}>Este mês</button>
        <button className="chip" onClick={() => setRange(monthRange(-1))}>Mês passado</button>
        <button className="chip" onClick={() => setRange({ from: '', to: '' })}>Tudo</button>
      </div>
      <div className="filters grid">
        <div>
          <label className="field" htmlFor="from">De</label>
          <input id="from" type="date" value={range.from} max={range.to || undefined} onChange={(e) => setRange({ ...range, from: e.target.value })} />
        </div>
        <div>
          <label className="field" htmlFor="to">Até</label>
          <input id="to" type="date" value={range.to} min={range.from || undefined} onChange={(e) => setRange({ ...range, to: e.target.value })} />
        </div>
        <div>
          <label className="field" htmlFor="player">Jogador</label>
          <Async q={balances}>{(list) => <PlayerSelect id="player" balances={list} value={playerId} onChange={setPlayerId} />}</Async>
        </div>
        <div>
          <label className="field" htmlFor="type">Motivo</label>
          <select id="type" value={fineTypeId} onChange={(e) => setFineTypeId(e.target.value)}>
            <option value="">Todos</option>
            {types.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="field" htmlFor="status">Estado</label>
          <select id="status" value={status} onChange={(e) => setStatus(e.target.value as FineStatus | '')}>
            <option value="">Todos</option>
            {(Object.keys(STATUS_LABEL) as FineStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </div>
      </div>

      <Async q={ledger}>
        {(rows) => {
          const active = rows.filter((r) => r.status !== 'cancelled')
          const total = active.reduce((s, r) => s + r.amount, 0)
          const open = active.reduce((s, r) => s + r.remaining, 0)
          return (
            <>
              <p className="summary">
                {active.length} {active.length === 1 ? 'multa' : 'multas'} · {money(total)} · por pagar {money(open)}
              </p>
              <FineList rows={rows} groupByDate />
            </>
          )
        }}
      </Async>
    </>
  )
}
