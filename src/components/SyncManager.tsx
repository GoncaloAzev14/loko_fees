import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useAuth } from '../lib/auth'
import { useSyncSummary } from '../lib/hooks'
import { OUTBOX_KEY } from '../lib/outbox'
import { flush, onFlushed, outbox } from '../lib/sync'

/**
 * Sends what is waiting whenever it can: the phone says it is back online, the app is brought to the
 * front, every half minute while something waits, and at start-up. It draws nothing (see SyncChip).
 * It sends only while the app is open: phones do not let a web app work in the background.
 */
export default function SyncManager() {
  const qc = useQueryClient()
  const { session } = useAuth()
  const uid = session?.user.id
  const { waiting } = useSyncSummary()

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

  return null
}
