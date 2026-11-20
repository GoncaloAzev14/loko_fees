import { useEffect, useState } from 'react'
import { describeEntry } from '../lib/entries'
import { useConfirm } from './Confirm'
import { RefreshIcon, TrashIcon } from './icons'
import IconButton from './IconButton'
import { useToast } from './Toast'
import { useLookups, useSyncSummary } from '../lib/hooks'
import type { Entry } from '../lib/outbox'
import { flush, outbox } from '../lib/sync'

/**
 * A small chip in the header that appears only when there is something to say about the connection or
 * about entries waiting to be sent. Nothing sits over the page: the details open in a panel when it is
 * tapped, and close again. (The sending itself is done by SyncManager.)
 */
export default function SyncChip() {
  const { entries, online, status, waiting, failed } = useSyncSummary()
  const [open, setOpen] = useState(false)
  const quiet = online && !status.unreachable && waiting === 0 && failed === 0

  useEffect(() => {
    if (quiet) setOpen(false)
  }, [quiet])
  useEffect(() => {
    if (!open) return
    const close = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [open])

  if (quiet) return null

  const label =
    failed > 0 && waiting === 0 ? `${failed} não ${failed === 1 ? 'aceite' : 'aceites'}`
    : status.syncing ? 'A sincronizar'
    : !online ? (waiting > 0 ? `Offline · ${waiting}` : 'Offline')
    : status.unreachable ? `Sem resposta · ${waiting}`
    : `${waiting} por enviar`

  const headline =
    failed > 0 && waiting === 0 ? `${failed} ${failed === 1 ? 'alteração não foi aceite' : 'alterações não foram aceites'}`
    : status.syncing ? 'A sincronizar…'
    : !online ? (waiting > 0 ? `Sem ligação · ${waiting} por sincronizar` : 'Sem ligação')
    : status.unreachable ? `Servidor sem resposta · ${waiting} por sincronizar`
    : `${waiting} por sincronizar`
  const detail = !online
    ? waiting > 0
      ? 'Guardado no telemóvel. Segue quando houver ligação. Os totais só mudam depois.'
      : 'A mostrar os últimos dados guardados.'
    : waiting > 0 ? 'Os totais mudam depois de sincronizar.' : undefined

  return (
    <div className="sync">
      <button className={`sync-chip${failed > 0 ? ' fail' : ''}`} aria-expanded={open} aria-haspopup="dialog" aria-label={`${headline}. Toque para ver.`} onClick={() => setOpen((v) => !v)}>
        <i className={`dot${status.syncing ? ' spin' : ''}`} aria-hidden="true" />
        <span>{label}</span>
      </button>
      {open && (
        <>
          <button className="sync-scrim" aria-label="Fechar" onClick={() => setOpen(false)} />
          <div className="sync-panel" role="dialog" aria-label="Estado da sincronização">
            <div className="row-title">{headline}</div>
            {detail && <p className="muted small" style={{ margin: '2px 0 0' }}>{detail}</p>}
            {online && waiting > 0 && !status.syncing && (
              <button className="btn small" style={{ marginTop: 10 }} onClick={() => void flush()}>Sincronizar agora</button>
            )}
            {entries.length > 0 && <EntryList entries={entries} online={online} />}
          </div>
        </>
      )}
    </div>
  )
}

function EntryList({ entries, online }: { entries: Entry[]; online: boolean }) {
  const { players, types } = useLookups()
  const ask = useConfirm()
  const toast = useToast()
  const describe = (e: Entry) => describeEntry(e, (id) => players.get(id)?.name, (id) => types.get(id)?.name)
  return (
    <ul className="sync-list">
      {entries.map((e) => (
        <li key={e.id}>
          <div className="row-title">{describe(e)}</div>
          <div className="row-sub">{e.failed ? 'Não foi aceite' : online ? 'À espera de ser enviado' : 'A aguardar ligação'}</div>
          {e.failed && <p className="why small">{e.failed}</p>}
          <div className="row-actions">
            {e.failed && <IconButton Icon={RefreshIcon} label="Tentar de novo" onClick={() => { outbox.retry(e.id); void flush(); toast('A tentar enviar outra vez') }} />}
            <IconButton
              Icon={TrashIcon} label="Descartar" tone="danger"
              onClick={async () => {
                const yes = await ask({ title: 'Descartar esta alteração?', message: 'Não será enviada ao servidor e perde-se.', confirmLabel: 'Descartar', cancelLabel: 'Manter', tone: 'danger' })
                if (yes) {
                  outbox.discard(e.id)
                  toast('Alteração descartada')
                }
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
