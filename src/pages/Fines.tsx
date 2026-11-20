import { useMemo, useState } from 'react'
import { FineList } from '../components/FineList'
import { ArrowRightIcon, SlidersIcon } from '../components/icons'
import { Async, PlayerSelect } from '../components/ui'
import { money, monthRange } from '../lib/format'
import { STATUS_LABEL } from '../lib/labels'
import { useBalances, useFineTypes, useLedger, useQueuedEntries } from '../lib/hooks'
import { withQueuedFines } from '../lib/overlay'
import type { FineStatus } from '../lib/types'

/** Who got fined, when and why. The filters stay pinned under the header while the list scrolls. */
export default function Fines() {
  const [range, setRange] = useState(() => monthRange(0))
  const [playerId, setPlayerId] = useState('')
  const [fineTypeId, setFineTypeId] = useState('')
  const [status, setStatus] = useState<FineStatus | ''>('')
  const [more, setMore] = useState(false)
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
  const queued = useQueuedEntries()
  const extra = [playerId, fineTypeId, status].filter(Boolean).length
  const period = (r: { from: string; to: string }) => range.from === r.from && range.to === r.to

  return (
    <>
      <div className="sticky-box">
        <div className="filter-top">
          <div className="seg" role="group" aria-label="Período">
            <button className={period(monthRange(0)) ? 'on' : ''} aria-pressed={period(monthRange(0))} onClick={() => setRange(monthRange(0))}>Este mês</button>
            <button className={period(monthRange(-1)) ? 'on' : ''} aria-pressed={period(monthRange(-1))} onClick={() => setRange(monthRange(-1))}>Mês passado</button>
            <button className={period({ from: '', to: '' }) ? 'on' : ''} aria-pressed={period({ from: '', to: '' })} onClick={() => setRange({ from: '', to: '' })}>Tudo</button>
          </div>
          <button
            className={`filters-toggle${extra > 0 || more ? ' on' : ''}`}
            aria-expanded={more}
            aria-label={extra > 0 ? `Filtros (${extra} ativos)` : 'Filtros'}
            title="Filtros"
            onClick={() => setMore((m) => !m)}
          >
            <SlidersIcon />
            {extra > 0 && <i className="count">{extra}</i>}
          </button>
        </div>

        <div className="dates">
          <label className="field-inline">
            <span>De</span>
            <input type="date" aria-label="Data inicial" value={range.from} max={range.to || undefined} onChange={(e) => setRange({ ...range, from: e.target.value })} />
          </label>
          <ArrowRightIcon className="ic sm dates-arrow" />
          <label className="field-inline">
            <span>Até</span>
            <input type="date" aria-label="Data final" value={range.to} min={range.from || undefined} onChange={(e) => setRange({ ...range, to: e.target.value })} />
          </label>
        </div>

        {more && (
          <div className="sel-row">
            <Async q={balances}>
              {(list) => <PlayerSelect ariaLabel="Jogador" balances={list} value={playerId} onChange={setPlayerId} placeholder="Jogador" />}
            </Async>
            <select aria-label="Motivo" value={fineTypeId} onChange={(e) => setFineTypeId(e.target.value)}>
              <option value="">Motivo</option>
              {types.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select aria-label="Estado" value={status} onChange={(e) => setStatus(e.target.value as FineStatus | '')}>
              <option value="">Estado</option>
              {(Object.keys(STATUS_LABEL) as FineStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>
        )}

        <Async q={ledger}>
          {(rows) => {
            const active = rows.filter((r) => r.status !== 'cancelled')
            const total = active.reduce((s, r) => s + r.amount, 0)
            const open = active.reduce((s, r) => s + r.remaining, 0)
            return (
              <div className="stats3">
                <div className="stat"><b>{active.length}</b><small>{active.length === 1 ? 'multa' : 'multas'}</small></div>
                <div className="stat"><b>{money(total)}</b><small>total</small></div>
                <div className={`stat${open > 0 ? ' due' : ''}`}><b>{money(open)}</b><small>por pagar</small></div>
              </div>
            )
          }}
        </Async>
      </div>

      <Async q={ledger}>{(rows) => <FineList
          rows={withQueuedFines(rows, queued, filter)} groupBy="day"
          filtering={Boolean(playerId || fineTypeId || status)}
          resetKey={`${range.from}|${range.to}|${playerId}|${fineTypeId}|${status}`}
        />}</Async>
    </>
  )
}
