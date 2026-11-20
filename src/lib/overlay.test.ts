import { describe, expect, it } from 'vitest'
import type { Entry } from './outbox'
import { withQueuedExpenses, withQueuedFines, withQueuedIncomes, withQueuedPayments } from './overlay'
import type { LedgerRow, Payment } from './types'

let n = 0
const at = (e: object) => ({ id: `e${++n}`, uid: 'ana', at: n, ...e }) as Entry
const insert = (table: string, row: object) => at({ op: 'insert', table, row })

const fineRow = (o: Partial<LedgerRow> = {}): LedgerRow => ({
  id: 'f-server', seq: 5, player_id: 'p1', fine_type_id: 't1', kind: 'fine', amount: 3, fined_on: '2026-11-01',
  description: null, late_for_month: null, cancelled: false, due_on: '2026-12-07', paid_amount: 0, remaining: 3, status: 'pending', ...o,
})

describe('withQueuedFines', () => {
  it('shows a waiting fine, marked, in date order, without inventing a due date or status', () => {
    const rows = [fineRow({ id: 'a', fined_on: '2026-11-05' }), fineRow({ id: 'b', fined_on: '2026-10-01' })]
    const out = withQueuedFines(rows, [insert('fines', { id: 'q', player_id: 'p2', fine_type_id: 't1', amount: '2', fined_on: '2026-11-03', description: 'atraso' })])
    expect(out.map((r) => r.id)).toEqual(['a', 'q', 'b'])
    expect(out[1]).toMatchObject({ sync: 'queued', status: 'pending', amount: 2, due_on: '', description: 'atraso', paid_amount: 0, remaining: 2 })
  })

  it('puts a waiting fine before the others of the same day', () => {
    const out = withQueuedFines([fineRow({ id: 'a', fined_on: '2026-11-03' })], [insert('fines', { id: 'q', player_id: 'p1', amount: 1, fined_on: '2026-11-03' })])
    expect(out.map((r) => r.id)).toEqual(['q', 'a'])
  })

  it('respects the list filters', () => {
    const entries = [
      insert('fines', { id: 'q1', player_id: 'p1', fine_type_id: 't1', amount: 1, fined_on: '2026-11-03' }),
      insert('fines', { id: 'q2', player_id: 'p2', fine_type_id: 't2', amount: 1, fined_on: '2026-11-04' }),
    ]
    expect(withQueuedFines([], entries, { playerId: 'p2' }).map((r) => r.id)).toEqual(['q2'])
    expect(withQueuedFines([], entries, { fineTypeId: 't1' }).map((r) => r.id)).toEqual(['q1'])
    expect(withQueuedFines([], entries, { from: '2026-11-04' }).map((r) => r.id)).toEqual(['q2'])
    expect(withQueuedFines([], entries, { to: '2026-11-03' }).map((r) => r.id)).toEqual(['q1'])
    expect(withQueuedFines([], entries, { status: 'paid' })).toEqual([]) // its real status is unknown, so not "paid"
    expect(withQueuedFines([], entries, { status: 'pending' })).toHaveLength(2)
  })

  it('marks an existing fine whose delete or cancel is waiting', () => {
    const rows = [fineRow({ id: 'a' }), fineRow({ id: 'b' }), fineRow({ id: 'c', cancelled: true, status: 'cancelled' }), fineRow({ id: 'd' })]
    const out = withQueuedFines(rows, [
      at({ op: 'delete', table: 'fines', rowId: 'a' }),
      at({ op: 'cancel', rowId: 'b', cancelled: true }),
      at({ op: 'cancel', rowId: 'c', cancelled: false }),
    ])
    expect(Object.fromEntries(out.map((r) => [r.id, r.sync]))).toEqual({ a: 'deleting', b: 'cancelling', c: 'restoring', d: undefined })
  })

  it('does not show a row twice once the server already has it', () => {
    const out = withQueuedFines([fineRow({ id: 'same' })], [insert('fines', { id: 'same', player_id: 'p1', amount: 3, fined_on: '2026-11-01' })])
    expect(out).toHaveLength(1)
    expect(out[0].sync).toBeUndefined()
  })

  it('leaves out entries the server refused', () => {
    const out = withQueuedFines([], [{ ...insert('fines', { id: 'q', player_id: 'p1', amount: 1, fined_on: '2026-11-03' }), failed: 'no' } as Entry])
    expect(out).toEqual([])
  })
})

describe('payments, income and expenses', () => {
  const pay = (o: Partial<Payment>): Payment => ({ id: 'p', player_id: 'p1', amount: 2, paid_on: '2026-11-01', note: null, ...o })

  it('shows waiting payments for the right player, newest first, and marks waiting deletes', () => {
    const rows = [pay({ id: 'a', paid_on: '2026-11-02' }), pay({ id: 'b', paid_on: '2026-10-20' })]
    const entries = [
      insert('payments', { id: 'q', player_id: 'p1', amount: 5, paid_on: '2026-11-02', note: 'x' }),
      insert('payments', { id: 'other', player_id: 'p2', amount: 1, paid_on: '2026-11-03' }),
      at({ op: 'delete', table: 'payments', rowId: 'b' }),
    ]
    const out = withQueuedPayments(rows, entries, 'p1')
    expect(out.map((p) => [p.id, p.sync])).toEqual([['q', 'queued'], ['a', undefined], ['b', 'deleting']])
    expect(withQueuedPayments(rows, entries).map((p) => p.id)).toContain('other')
  })

  it('keeps how a waiting payment was made, and ignores anything that is not MB WAY or cash', () => {
    const out = withQueuedPayments([], [
      insert('payments', { id: 'm', player_id: 'p1', amount: 5, paid_on: '2026-11-02', method: 'mbway' }),
      insert('payments', { id: 'd', player_id: 'p1', amount: 5, paid_on: '2026-11-03', method: 'dinheiro' }),
      insert('payments', { id: 'x', player_id: 'p1', amount: 5, paid_on: '2026-11-04', method: 'cartao' }),
      insert('payments', { id: 'n', player_id: 'p1', amount: 5, paid_on: '2026-11-05' }),
    ])
    expect(Object.fromEntries(out.map((p) => [p.id, p.method]))).toEqual({ m: 'mbway', d: 'dinheiro', x: null, n: null })
  })

  it('never cuts a long list short: every payment comes back, old ones included', () => {
    const many = Array.from({ length: 300 }, (_, i) => pay({ id: `p${i}`, paid_on: `2026-${String(1 + (i % 12)).padStart(2, '0')}-10` }))
    expect(withQueuedPayments(many, [])).toHaveLength(300)
    expect(withQueuedPayments(many, [insert('payments', { id: 'q', player_id: 'p1', amount: 1, paid_on: '2026-11-02' })])).toHaveLength(301)
  })

  it('shows waiting income and expenses, and marks waiting deletes', () => {
    const incomes = withQueuedIncomes(
      [{ id: 'i1', player_id: null, amount: 40, received_on: '2026-10-03', description: 'Prémio' }],
      [insert('incomes', { id: 'qi', amount: 10, received_on: '2026-11-01', description: 'Donativo' }), at({ op: 'delete', table: 'incomes', rowId: 'i1' })],
    )
    expect(incomes.map((i) => [i.id, i.sync])).toEqual([['qi', 'queued'], ['i1', 'deleting']])
    const expenses = withQueuedExpenses([], [insert('expenses', { id: 'qx', amount: 12, spent_on: '2026-11-02', description: 'Jantar' })])
    expect(expenses).toEqual([{ id: 'qx', amount: 12, spent_on: '2026-11-02', description: 'Jantar', sync: 'queued' }])
  })
})
