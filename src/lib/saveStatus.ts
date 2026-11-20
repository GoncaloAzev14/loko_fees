export interface SaveStatus {
  tone: 'good' | 'warn' | 'bad'
  text: string
}

/** What saving answered: `queued` = kept only on the phone; `ids` = the outbox entries that stand for it. */
export interface Saved {
  queued: boolean
  ids: string[]
}

/**
 * What to tell the person right after they saved something, so nobody believes it is saved when it is not.
 * It follows the entries of THIS save and no others: an older refused entry elsewhere in the queue says
 * nothing about it. `entries` is what is in the outbox now.
 */
export function saveStatus(saved: Saved | null, entries: { id: string; failed?: string }[]): SaveStatus | null {
  if (!saved) return null
  if (!saved.queued) return { tone: 'good', text: 'Guardado no servidor ✓' }
  if (saved.ids.length === 0) return { tone: 'good', text: 'Feito: a alteração ainda não tinha sido enviada' } // undone before it ever left the phone
  const mine = entries.filter((e) => saved.ids.includes(e.id))
  if (mine.some((e) => e.failed)) return { tone: 'bad', text: 'O servidor não aceitou: veja o Histórico' }
  if (mine.length > 0) return { tone: 'warn', text: 'Guardado só no telemóvel: falta enviar' }
  return { tone: 'good', text: 'Guardado no servidor ✓' } // it was waiting, and has been sent since
}
