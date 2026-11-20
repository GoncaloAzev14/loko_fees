import { beforeEach, describe, expect, it, vi } from 'vitest'

type Call = { table: string; op: 'upsert' | 'delete' | 'update'; rows?: unknown; opts?: unknown; id?: string; patch?: unknown }
const supa = vi.hoisted(() => ({
  session: { user: { id: 'ana' } } as { user: { id: string } } | null,
  calls: [] as { table: string; op: string; rows?: unknown; opts?: unknown; id?: string; patch?: unknown }[],
  /** what the server answers to the next call; null = success */
  next: null as null | ((call: { table: string; op: string; rows?: unknown; id?: string }) => { error: { message: string; code?: string } | null; status?: number }),
}))

vi.mock('./supabase', () => {
  const respond = (call: Call) => {
    supa.calls.push(call)
    return Promise.resolve(supa.next ? supa.next(call) : { error: null, status: 200 })
  }
  return {
    supabase: {
      auth: { getSession: async () => ({ data: { session: supa.session } }) },
      from: (table: string) => ({
        upsert: (rows: unknown, opts: unknown) => respond({ table, op: 'upsert', rows, opts }),
        delete: () => ({ eq: (_c: string, id: string) => respond({ table, op: 'delete', id }) }),
        update: (patch: unknown) => ({ eq: (_c: string, id: string) => respond({ table, op: 'update', id, patch }) }),
      }),
    },
  }
})

const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size },
})
const net = { onLine: true }
vi.stubGlobal('navigator', net)

import { addFines, addPayment, deleteFine, deletePayment, setFineCancelled } from './api'
import { flush, outbox } from './sync'

const NO_NETWORK = { error: { message: 'TypeError: Failed to fetch', code: '' }, status: 0 }
const REFUSED = { error: { message: 'violates foreign key constraint', code: '23503' }, status: 409 }
const entries = () => outbox.forUser('ana')
const rowIds = () => entries().map((e) => (e.op === 'insert' ? e.row.id : e.op === 'delete' ? e.rowId : e.rowId))

beforeEach(() => {
  store.clear()
  outbox.reload()
  supa.calls = []
  supa.next = null
  supa.session = { user: { id: 'ana' } }
  net.onLine = true
})

const payment = { player_id: 'p1', amount: 5, paid_on: '2026-11-10' }

describe('with a connection and nothing waiting', () => {
  it('sends straight away, by id, ignoring a row that already exists', async () => {
    const r = await addPayment(payment)
    expect(r).toEqual({ queued: false, ids: [] })
    expect(supa.calls).toHaveLength(1)
    expect(supa.calls[0]).toMatchObject({ table: 'payments', op: 'upsert', opts: { onConflict: 'id', ignoreDuplicates: true } })
    expect((supa.calls[0].rows as { id: string }[])[0].id).toMatch(/^[0-9a-f-]{36}$/)
    expect(entries()).toHaveLength(0)
  })

  it('sends one fine per player in a single request', async () => {
    await addFines({ playerIds: ['a', 'b', 'c'], fineTypeId: 't', amount: 2, finedOn: '2026-11-10' })
    expect(supa.calls).toHaveLength(1)
    expect((supa.calls[0].rows as unknown[]).length).toBe(3)
    const ids = (supa.calls[0].rows as { id: string }[]).map((r) => r.id)
    expect(new Set(ids).size).toBe(3)
  })

  it('shows a refusal as an error and saves nothing', async () => {
    supa.next = () => REFUSED
    await expect(addPayment(payment)).rejects.toThrow('violates foreign key constraint')
    expect(entries()).toHaveLength(0)
  })
})

describe('without a connection', () => {
  it('saves on the phone, sends nothing, and says so', async () => {
    net.onLine = false
    const r = await addPayment(payment)
    expect(r).toMatchObject({ queued: true })
    expect(supa.calls).toHaveLength(0)
    expect(entries()).toHaveLength(1)
  })

  it('sends it, once, when the connection is back', async () => {
    net.onLine = false
    await addPayment(payment)
    const [queued] = entries()
    net.onLine = true
    const result = await flush()
    expect(result).toEqual({ sent: 1, failed: 0, stopped: false })
    expect(supa.calls).toHaveLength(1)
    expect((supa.calls[0].rows as { id: string }[])[0].id).toBe(queued.op === 'insert' ? queued.row.id : '')
    expect(entries()).toHaveLength(0)
    expect(await flush()).toEqual({ sent: 0, failed: 0, stopped: false }) // nothing left to send
    expect(supa.calls).toHaveLength(1)
  })

  it('keeps everything in order, and sends what was made offline after the connection returns', async () => {
    net.onLine = false
    await addPayment({ ...payment, amount: 1 })
    await addFines({ playerIds: ['a'], fineTypeId: 't', amount: 2, finedOn: '2026-11-10' })
    await deletePayment('server-payment')
    net.onLine = true
    await flush()
    expect(supa.calls.map((c) => `${c.table}:${c.op}`)).toEqual(['payments:upsert', 'fines:upsert', 'payments:delete'])
  })

  it('a fine added and deleted before it was ever sent never reaches the server', async () => {
    net.onLine = false
    await addFines({ playerIds: ['a'], fineTypeId: 't', amount: 2, finedOn: '2026-11-10' })
    const id = rowIds()[0]
    await deleteFine(id)
    net.onLine = true
    await flush()
    expect(supa.calls).toHaveLength(0)
  })

  it('a cancel on a fine that was never sent goes out as part of the fine itself', async () => {
    net.onLine = false
    await addFines({ playerIds: ['a'], fineTypeId: 't', amount: 2, finedOn: '2026-11-10' })
    await setFineCancelled(rowIds()[0], true)
    net.onLine = true
    await flush()
    expect(supa.calls).toHaveLength(1)
    expect((supa.calls[0].rows as { cancelled: boolean }[])[0].cancelled).toBe(true)
  })
})

describe('when the phone says online but the server cannot be reached', () => {
  it('saves instead of failing, then sends the same row id later without duplicating it', async () => {
    supa.next = () => NO_NETWORK
    const r = await addPayment(payment)
    expect(r).toMatchObject({ queued: true })
    const sentFirst = (supa.calls[0].rows as { id: string }[])[0].id
    expect(rowIds()).toEqual([sentFirst]) // the very same id is kept for the retry

    supa.next = () => NO_NETWORK
    expect(await flush()).toEqual({ sent: 0, failed: 0, stopped: true }) // still down: kept
    expect(entries()).toHaveLength(1)

    supa.next = null
    await flush()
    expect((supa.calls[supa.calls.length - 1].rows as { id: string }[])[0].id).toBe(sentFirst)
    expect(entries()).toHaveLength(0)
  })

  it('waits behind older entries, so changes keep their order even when online', async () => {
    supa.next = () => NO_NETWORK
    await addPayment({ ...payment, amount: 1 }) // saved
    supa.next = null
    const r = await addPayment({ ...payment, amount: 2 }) // must not overtake the first
    expect(r).toMatchObject({ queued: true })
    supa.calls = []
    await flush()
    expect(supa.calls.map((c) => (c.rows as { amount: number }[])[0].amount)).toEqual([1, 2])
  })
})

describe('when the server refuses an entry for good', () => {
  it('marks it, goes on with the rest, and does not retry it by itself', async () => {
    net.onLine = false
    await addFines({ playerIds: ['gone'], fineTypeId: 't', amount: 2, finedOn: '2026-11-10' })
    await addPayment(payment)
    net.onLine = true
    supa.next = (call) => (call.table === 'fines' ? REFUSED : { error: null, status: 200 })
    const result = await flush()
    expect(result).toEqual({ sent: 1, failed: 1, stopped: false })
    expect(entries()).toHaveLength(1)
    expect(entries()[0].failed).toMatch(/já não existe/)
    supa.calls = []
    await flush()
    expect(supa.calls).toHaveLength(0)
  })
})

describe('without a usable session', () => {
  it('keeps the entry instead of sending it as a visitor, which would be refused for good', async () => {
    net.onLine = false
    await addPayment(payment)
    net.onLine = true
    supa.session = null // token expired and not refreshed yet
    // the stored sign-in identifies who made it, but there is no live session to send with
    store.set('sb-x-auth-token', JSON.stringify({ user: { id: 'ana' } }))
    expect(await flush()).toEqual({ sent: 0, failed: 0, stopped: false })
    expect(supa.calls).toHaveLength(0)
    expect(entries()).toHaveLength(1)
    expect(entries()[0].failed).toBeUndefined()
  })

  it('queues new changes while the session cannot be used, even if the phone is online', async () => {
    supa.session = null
    store.set('sb-x-auth-token', JSON.stringify({ user: { id: 'ana' } }))
    const r = await addPayment(payment)
    expect(r).toMatchObject({ queued: true })
    expect(supa.calls).toHaveLength(0)
  })
})

describe('a refused entry in the queue', () => {
  it('does not hold back later saves: they go straight to the server', async () => {
    net.onLine = false
    await addFines({ playerIds: ['gone'], fineTypeId: 't', amount: 2, finedOn: '2026-11-10' })
    net.onLine = true
    supa.next = () => REFUSED
    await flush() // the server refuses it: it stays, marked
    expect(entries()[0].failed).toBeTruthy()
    supa.next = null
    supa.calls = []
    const r = await addPayment(payment)
    expect(r).toEqual({ queued: false, ids: [] }) // sent at once, not queued behind the refused one
    expect(supa.calls).toHaveLength(1)
    expect(entries()).toHaveLength(1) // the refused one is still there, waiting for a decision
  })
})

describe('what saving answers', () => {
  it('names the entries kept on the phone, so the screen can follow them', async () => {
    net.onLine = false
    const r = await addFines({ playerIds: ['a', 'b'], fineTypeId: 't', amount: 2, finedOn: '2026-11-10' })
    expect(r.queued).toBe(true)
    expect(r.ids).toHaveLength(2)
    expect(r.ids.sort()).toEqual(entries().map((e) => e.id).sort())
  })

  it('names nothing for a fine that was added and deleted before it left the phone', async () => {
    net.onLine = false
    await addFines({ playerIds: ['a'], fineTypeId: 't', amount: 2, finedOn: '2026-11-10' })
    const r = await deleteFine(rowIds()[0])
    expect(r).toEqual({ queued: true, ids: [] })
  })
})

describe('another user on the same phone', () => {
  it('never sends the first user\'s entries', async () => {
    net.onLine = false
    await addPayment(payment)
    await flush() // lets the sync started by that save finish while still offline
    net.onLine = true
    supa.session = { user: { id: 'bia' } }
    expect(await flush()).toEqual({ sent: 0, failed: 0, stopped: false })
    expect(supa.calls).toHaveLength(0)
    expect(entries()).toHaveLength(1)
  })
})
