import { useQueuedEntries } from '../lib/hooks'
import { saveStatus, type Saved } from '../lib/saveStatus'

/** The answer to "did that really save?": on the server, only on this phone, or refused. Pass an action's `saved`. */
export default function SaveStatus({ save }: { save: Saved | null }) {
  const entries = useQueuedEntries()
  const s = saveStatus(save, entries)
  if (!s) return null
  return <p className={`${s.tone === 'good' ? 'good' : s.tone === 'warn' ? 'warn' : 'error'} form-msg`} role="status">{s.text}</p>
}
