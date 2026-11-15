import type { Entry, Table } from './outbox'
import type { Expense, Income, LedgerFilter, LedgerRow, Payment, SyncMark } from './types'

/**
 * Puts what is waiting in the outbox on top of what the server last said, for the lists only.
 *
 * Waiting entries show up in the list, marked, so the person sees that their entry was saved. Totals,
 * balances and statuses are NOT recalculated here: the rules for those live in the database, and they
 * catch up when the entries are sent. Entries the server refused (`failed`) are left out: they are
 * not going to happen, and the sync sheet is where they are dealt with.
 */

const waiting = (entries: Entry[]) => entries.filter((e) => !e.failed)

const insertsOf = (entries: Entry[], table: Table) =>
  waiting(entries).flatMap((e) => (e.op === 'insert' && e.table === table ? [e.row] : []))

const deletedIds = (entries: Entry[], table: Table) =>
  new Set(waiting(entries).flatMap((e) => (e.op === 'delete' && e.table === table ? [e.rowId] : [])))

const str = (v: unknown) => (typeof v === 'string' ? v : '')
const num = (v: unknown) => Number(v) || 0

/** Existing rows, marked where a delete is waiting; plus waiting new rows that the server does not have yet. */
function merge<T extends { id: string; sync?: SyncMark }>(
  rows: T[],
  entries: Entry[],
  table: Table,
  make: (row: Record<string, unknown> & { id: string }) => T,
  keep: (row: T) => boolean,
  newestFirst: (a: T, b: T) => number,
): T[] {
  const gone = deletedIds(entries, table)
  const known = new Set(rows.map((r) => r.id))
  const marked = rows.map((r) => (gone.has(r.id) ? { ...r, sync: 'deleting' as const } : r))
  const added = insertsOf(entries, table)
    .filter((row) => !known.has(row.id)) // already on the server: do not show it twice
    .map(make)
    .filter(keep)
  return [...marked, ...added].sort(newestFirst)
}

const byDateDesc = <T extends { sync?: SyncMark }>(date: (t: T) => string) => (a: T, b: T) =>
  date(b).localeCompare(date(a)) || Number(b.sync === 'queued') - Number(a.sync === 'queued')

export function withQueuedFines(rows: LedgerRow[], entries: Entry[], f: LedgerFilter = {}): LedgerRow[] {
  const flips = new Map(waiting(entries).flatMap((e) => (e.op === 'cancel' ? [[e.rowId, e.cancelled] as const] : [])))
  const marked = rows.map((r) => {
    const want = flips.get(r.id)
    return want !== undefined && want !== r.cancelled ? { ...r, sync: (want ? 'cancelling' : 'restoring') as SyncMark } : r
  })
  return merge(
    marked,
    entries,
    'fines',
    (row): LedgerRow => {
      const amount = num(row.amount)
      const cancelled = row.cancelled === true
      return {
        id: row.id,
        seq: Number.MAX_SAFE_INTEGER,
        player_id: str(row.player_id),
        fine_type_id: str(row.fine_type_id) || null,
        kind: 'fine',
        amount,
        fined_on: str(row.fined_on),
        description: str(row.description) || null,
        late_for_month: null,
        cancelled,
        due_on: '', // worked out by the database; unknown until it is sent
        paid_amount: 0,
        remaining: amount,
        status: cancelled ? 'cancelled' : 'pending',
        sync: 'queued',
      }
    },
    (r) =>
      (!f.playerId || r.player_id === f.playerId) &&
      (!f.fineTypeId || r.fine_type_id === f.fineTypeId) &&
      (!f.from || r.fined_on >= f.from) &&
      (!f.to || r.fined_on <= f.to) &&
      (!f.status || r.status === f.status),
    (a, b) => b.fined_on.localeCompare(a.fined_on) || b.seq - a.seq,
  )
}

export function withQueuedPayments(rows: Payment[], entries: Entry[], playerId?: string | null): Payment[] {
  return merge(
    rows,
    entries,
    'payments',
    (row): Payment => ({
      id: row.id,
      player_id: str(row.player_id),
      amount: num(row.amount),
      paid_on: str(row.paid_on),
      note: str(row.note) || null,
      sync: 'queued',
    }),
    (p) => !playerId || p.player_id === playerId,
    byDateDesc((p: Payment) => p.paid_on),
  )
}

export function withQueuedIncomes(rows: Income[], entries: Entry[]): Income[] {
  return merge(
    rows,
    entries,
    'incomes',
    (row): Income => ({
      id: row.id,
      player_id: str(row.player_id) || null,
      amount: num(row.amount),
      received_on: str(row.received_on),
      description: str(row.description),
      sync: 'queued',
    }),
    () => true,
    byDateDesc((i: Income) => i.received_on),
  )
}

export function withQueuedExpenses(rows: Expense[], entries: Entry[]): Expense[] {
  return merge(
    rows,
    entries,
    'expenses',
    (row): Expense => ({
      id: row.id,
      amount: num(row.amount),
      spent_on: str(row.spent_on),
      description: str(row.description),
      sync: 'queued',
    }),
    () => true,
    byDateDesc((x: Expense) => x.spent_on),
  )
}
