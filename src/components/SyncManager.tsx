import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { money } from '../lib/format'
import { useLookups, useOnline, useQueuedEntries, useSyncStatus } from '../lib/hooks'
import { OUTBOX_KEY, type Entry } from '../lib/outbox'
import { flush, onFlushed, outbox } from '../lib/sync'

const TABLE_LABEL = { fines: 'multa', payments: 'pagamento', incomes: 'receita', expenses: 'despesa' } as const

/**
 * Sends what is waiting whenever it can (the phone says it is back online, the app is brought to the
 * front, every half minute while something waits), and shows a bar saying what is going on.
 * It sends only while the app is open: phones do not let a web app work in the background.
 */
export default function SyncManager() {
  const qc = useQueryClient()
  const { session } = useAuth()
  const uid = session?.user.id
  const entries = useQueuedEntries()
  const online = useOnline()
  const status = useSyncStatus()
  const [open, setOpen] = useState(false)
  const waiting = entries.filter((e) => !e.failed).length
  const failed = entries.filter((e) => e.failed).length

  // after something was sent, every list and total is read again
  useEffect(() => onFlushed(() => void qc.invalidateQueries()), [qc])

  useEffect(() => {
    const go = () => void flush()
    const front = () => document.visibilityState === 'visible' && go()
    const otherTab = (e: StorageEvent) => e.key === OUTBOX_KEY && outbox.reload()
    go()
    window.addEventListener('online', go)
    document.addEventListener('visibilitychange', front)
    window.addEventListener('storage', otherTab)
    return () => {
      window.removeEventListener('online', go)
      document.removeEventListener('visibilitychange', front)
      window.removeEventListener('storage', otherTab)
    }
  }, [uid])

  useEffect(() => {
    if (waiting === 0) return
    const timer = setInterval(() => void flush(), 30_000)
    return () => clearInterval(timer)
  }, [waiting])

  if (online && !status.unreachable && waiting === 0 && failed === 0) return null

  const headline = failed > 0 && waiting === 0
    ? `${failed} ${failed === 1 ? 'alteração não foi aceite' : 'alterações não foram aceites'}`
    : status.syncing
      ? 'A sincronizar…'
      : !online
        ? waiting > 0 ? `Sem ligação · ${waiting} por sincronizar` : 'Sem ligação'
        : status.unreachable
          ? `Servidor sem resposta · ${waiting} por sincronizar`
          : `${waiting} por sincronizar`
  const detail = !online
    ? waiting > 0
      ? 'Guardado no telemóvel. Segue quando houver ligação. Os totais só mudam depois.'
      : 'A mostrar os últimos dados guardados.'
    : waiting > 0 ? 'Os totais mudam depois de sincronizar.' : undefined

  return (
    <div className={`sync-bar${failed > 0 ? ' fail' : ''}`} role="status">
      <button className="sync-head" aria-expanded={open} onClick={() => setOpen((v) => !v)} disabled={entries.length === 0}>
        <i className={`dot${status.syncing ? ' spin' : ''}`} aria-hidden="true" />
        <span className="txt">
          {headline}
          {detail && <small>{detail}</small>}
        </span>
        {entries.length > 0 && <span className="link">{open ? 'Fechar' : 'Ver'}</span>}
      </button>
      {open && entries.length > 0 && <Sheet entries={entries} online={online} />}
    </div>
  )
}

function Sheet({ entries, online }: { entries: Entry[]; online: boolean }) {
  const { players, types } = useLookups()
  const describe = (e: Entry) => {
    if (e.op === 'cancel') return e.cancelled ? 'Anular multa' : 'Repor multa'
    if (e.op === 'delete') return `Apagar ${TABLE_LABEL[e.table]}`
    const r = e.row
    const who = typeof r.player_id === 'string' ? players.get(r.player_id)?.name : undefined
    const what =
      e.table === 'fines' ? types.get(String(r.fine_type_id))?.name
      : e.table === 'payments' ? 'Pagamento'
      : String(r.description ?? (e.table === 'incomes' ? 'Receita' : 'Despesa'))
    return [what, who].filter(Boolean).join(' · ') + ` · ${money(Number(r.amount) || 0)}`
  }
  return (
    <div className="sync-sheet">
      <ul>
        {entries.map((e) => (
          <li key={e.id}>
            <div className="row-title">{describe(e)}</div>
            <div className="row-sub">{e.failed ? 'Não foi aceite' : online ? 'À espera de ser enviado' : 'A aguardar ligação'}</div>
            {e.failed && <p className="why small">{e.failed}</p>}
            <div className="row-actions">
              {e.failed && (
                <button className="link" onClick={() => { outbox.retry(e.id); void flush() }}>Tentar de novo</button>
              )}
              <button className="link danger" onClick={() => confirm('Descartar esta alteração? Não será enviada.') && outbox.discard(e.id)}>Descartar</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
