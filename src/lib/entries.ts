import { money } from './format'
import { payMethodLabel } from './labels'
import type { Entry } from './outbox'

const TABLE_LABEL = { fines: 'multa', payments: 'pagamento', incomes: 'receita', expenses: 'despesa' } as const

/** One saved-on-the-phone entry in words: what it will do and to whom. The lookups turn ids into names. */
export function describeEntry(e: Entry, playerName: (id: string) => string | undefined, typeName: (id: string) => string | undefined): string {
  if (e.op === 'cancel') return e.cancelled ? 'Anular multa' : 'Repor multa'
  if (e.op === 'delete') return `Apagar ${TABLE_LABEL[e.table]}`
  const r = e.row
  const who = typeof r.player_id === 'string' ? playerName(r.player_id) : undefined
  const what =
    e.table === 'fines' ? typeName(String(r.fine_type_id))
    : e.table === 'payments' ? ['Pagamento', payMethodLabel(r.method)].filter(Boolean).join(' ')
    : String(r.description ?? (e.table === 'incomes' ? 'Receita' : 'Despesa'))
  return [what, who].filter(Boolean).join(' · ') + ` · ${money(Number(r.amount) || 0)}`
}
