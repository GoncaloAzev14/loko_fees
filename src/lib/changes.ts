import { money } from './format'
import type { Change } from './types'

type Row = Record<string, unknown>

const TABLE: Record<string, string> = {
  fines: 'multa',
  payments: 'pagamento',
  incomes: 'receita',
  expenses: 'despesa',
  players: 'jogador',
  fine_types: 'tipo de multa',
  settings: 'definições',
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')
const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0)

/** The person's name for the list: the part of their email before the @, or "Sistema" for the app itself. */
export const whoLabel = (email: string | null) => (email ? email.split('@')[0] : 'Sistema')

/**
 * One change in words: what was done, and to what. `players` and `types` turn the ids stored in the
 * record into names. Anything unrecognised still gets a plain line rather than nothing.
 */
export function describeChange(c: Change, players: Map<string, string>, types: Map<string, string>): { title: string; detail: string } {
  const row: Row = (c.action === 'delete' ? c.old_row : c.new_row) ?? {}
  const before: Row = c.old_row ?? {}
  const kind = c.table_name === 'fines' && row.kind === 'late_fee' ? 'multa de atraso' : (TABLE[c.table_name] ?? c.table_name)

  let verb = c.action === 'insert' ? 'Adicionou' : c.action === 'delete' ? 'Apagou' : 'Alterou'
  if (c.action === 'update' && c.table_name === 'fines' && before.cancelled !== row.cancelled) verb = row.cancelled ? 'Anulou' : 'Repôs'

  const player = players.get(str(row.player_id))
  const amount = (n: unknown) => money(num(n))
  let detail = ''
  switch (c.table_name) {
    case 'fines':
      detail = [player, row.kind === 'late_fee' ? '' : types.get(str(row.fine_type_id)), amount(row.amount)].filter(Boolean).join(' · ')
      break
    case 'payments':
      detail = [player, amount(row.amount)].filter(Boolean).join(' · ')
      break
    case 'incomes':
    case 'expenses':
      detail = [str(row.description), player, amount(row.amount)].filter(Boolean).join(' · ')
      break
    case 'players':
    case 'fine_types':
      detail = str(row.name)
      break
    case 'settings': {
      const changed = Object.keys(row).filter((k) => before[k] !== undefined && JSON.stringify(before[k]) !== JSON.stringify(row[k]))
      detail = changed.map((k) => `${k}: ${String(before[k])} → ${String(row[k])}`).join(', ')
      break
    }
  }
  return { title: `${verb} ${kind}`, detail }
}
