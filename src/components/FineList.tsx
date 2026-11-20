import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { formatDate, money } from '../lib/format'
import { deleteFine, setFineCancelled } from '../lib/api'
import { useAction, useLookups } from '../lib/hooks'
import { fineName } from '../lib/labels'
import type { LedgerRow } from '../lib/types'
import { useConfirm } from './Confirm'
import SaveStatus from './SaveStatus'
import type { GroupBy } from '../lib/groups'
import Folded from './Folded'
import { ErrorNote, StatusBadge, SyncBadge } from './ui'

/**
 * Fines with their status. Admins also get cancel / delete buttons. With `groupBy` the fines are folded into
 * days or months that open and close (see Folded); without it they are one flat list.
 */
export function FineList({
  rows, showPlayer = true, groupBy, filtering = false, resetKey,
}: { rows: LedgerRow[]; showPlayer?: boolean; groupBy?: GroupBy; filtering?: boolean; resetKey?: string }) {
  const { players, types } = useLookups()
  const { isAdmin } = useAuth()
  // one action for both buttons, so there is one status line: the latest thing that was done
  const act = useAction(
    (kind: 'cancel' | 'delete', id: string, cancelled?: boolean, _late?: boolean) =>
      kind === 'cancel' ? setFineCancelled(id, Boolean(cancelled)) : deleteFine(id),
    (_result, kind, _id, cancelled?: boolean, late?: boolean) =>
      kind === 'cancel' ? (cancelled ? 'Multa anulada' : 'Multa reposta') : late ? 'Multa de atraso apagada' : 'Multa apagada',
  )
  const ask = useConfirm()

  if (rows.length === 0) return <p className="muted pad">Sem multas para mostrar.</p>

  const item = (r: LedgerRow) => (
    <li key={r.id} className={`row ${r.status}${r.sync ? ' waiting' : ''}`}>
      <div className="row-main">
        <div className="row-title">
          {showPlayer && (
            <Link to={`/players/${r.player_id}`}>{players.get(r.player_id)?.name ?? '…'}</Link>
          )}
          {showPlayer && ' · '}
          {fineName(r, types)}
        </div>
        <div className="row-sub">
          {groupBy !== 'day' && <>{formatDate(r.fined_on)} · </>}
          {r.description && <>{r.description} · </>}
          {r.due_on ? <>vence {formatDate(r.due_on)}</> : 'guardada no telemóvel'}
        </div>
        {isAdmin && (!r.sync || r.sync === 'queued') && (
          <div className="row-actions">
            <button className="link" disabled={act.busy} onClick={() => act.run('cancel', r.id, !r.cancelled)}>
              {r.cancelled ? 'Repor' : 'Anular'}
            </button>
            <button
              className="link danger"
              disabled={act.busy}
              onClick={async () => {
                const late = r.kind === 'late_fee'
                const yes = await ask(
                  late
                    ? { title: 'Apagar esta multa de atraso?', message: 'Não volta a ser aplicada a este jogador neste mês. Pode repô-la no Histórico.', confirmLabel: 'Apagar', tone: 'danger' }
                    : { title: 'Apagar esta multa?', message: 'Fica apagada. Pode repô-la no Histórico.', confirmLabel: 'Apagar', tone: 'danger' },
                )
                if (yes) act.run('delete', r.id, undefined, late)
              }}
            >
              Apagar
            </button>
          </div>
        )}
      </div>
      <div className="row-side">
        <div className="amount">{money(r.amount)}</div>
        {r.sync ? <SyncBadge sync={r.sync} /> : <StatusBadge status={r.status} remaining={r.remaining} amount={r.amount} />}
      </div>
    </li>
  )

  const errors = (
    <>
      <ErrorNote error={act.error} />
      <SaveStatus save={act.saved} />
    </>
  )
  if (!groupBy)
    return (
      <>
        {errors}
        <ul className="list">{rows.map(item)}</ul>
      </>
    )

  return (
    <>
      {errors}
      <Folded
        rows={rows} by={groupBy} dateOf={(r) => r.fined_on} amountOf={(r) => (r.cancelled ? 0 : r.amount)}
        render={item} filtering={filtering} resetKey={resetKey} idPrefix="fines" noun={['multa', 'multas']}
      />
    </>
  )
}
