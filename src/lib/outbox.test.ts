import { beforeEach, describe, expect, it } from 'vitest'
import { createOutbox, OutboxError, type Entry, type Storage } from './outbox'
import { ApiError, explainRefusal, isRetryable } from './errors'

const memory = (): Storage & { data: Map<string, string>; failWrites: boolean } => {
  const data = new Map<string, string>()
  return {
    data,
    failWrites: false,
    getItem: (k) => data.get(k) ?? null,
    setItem(k, v) {
      if (this.failWrites) throw new Error('quota')
      data.set(k, v)
    },
  }
}

let n = 0
const newId = () => `e${++n}`
const fine = (id: string, extra: object = {}) => ({ op: 'insert' as const, table: 'fines' as const, row: { id, player_id: 'p1', amount: 2, ...extra } })

let storage: ReturnType<typeof memory>
let box: ReturnType<typeof createOutbox>
beforeEach(() => {
  n = 0
  storage = memory()
  box = createOutbox(storage, 'k', newId)
})

describe('enqueue', () => {
  it('keeps changes in the order they were made, per user', () => {
    box.enqueue('ana', [fine('f1'), fine('f2')])
    box.enqueue('bia', [fine('f3')])
    expect(box.forUser('ana').map((e) => e.op === 'insert' && e.row.id)).toEqual(['f1', 'f2'])
    expect(box.forUser('bia')).toHaveLength(1)
    expect(box.hasEntries('ana')).toBe(true)
    expect(box.hasEntries('cris')).toBe(false)
  })

  it('survives a restart: a new outbox on the same storage sees the same entries', () => {
    box.enqueue('ana', [fine('f1')])
    const again = createOutbox(storage, 'k', newId)
    expect(again.forUser('ana')).toHaveLength(1)
  })

  it('deleting something that was never sent just cancels it', () => {
    box.enqueue('ana', [fine('f1'), { op: 'cancel', rowId: 'f1', cancelled: true }])
    box.enqueue('ana', [{ op: 'delete', table: 'fines', rowId: 'f1' }])
    expect(box.forUser('ana')).toHaveLength(0)
  })

  it('cancelling something that was never sent edits it instead', () => {
    box.enqueue('ana', [fine('f1')])
    box.enqueue('ana', [{ op: 'cancel', rowId: 'f1', cancelled: true }])
    const [e] = box.forUser('ana')
    expect(box.forUser('ana')).toHaveLength(1)
    expect(e.op === 'insert' && e.row.cancelled).toBe(true)
  })

  it('a later cancel of an existing fine replaces the earlier one', () => {
    box.enqueue('ana', [{ op: 'cancel', rowId: 'server1', cancelled: true }])
    box.enqueue('ana', [{ op: 'cancel', rowId: 'server1', cancelled: false }])
    const entries = box.forUser('ana')
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ op: 'cancel', cancelled: false })
  })

  it('deleting an existing fine drops its waiting cancel and is queued once', () => {
    box.enqueue('ana', [{ op: 'cancel', rowId: 'server1', cancelled: true }])
    box.enqueue('ana', [{ op: 'delete', table: 'fines', rowId: 'server1' }, { op: 'delete', table: 'fines', rowId: 'server1' }])
    expect(box.forUser('ana').map((e) => e.op)).toEqual(['delete'])
  })

  it('does not touch another user\'s entries when folding', () => {
    box.enqueue('bia', [fine('f1')])
    box.enqueue('ana', [{ op: 'delete', table: 'fines', rowId: 'f1' }])
    expect(box.forUser('bia')).toHaveLength(1)
    expect(box.forUser('ana')).toHaveLength(1) // ana never queued f1, so this is a real delete
  })

  it('refuses, loudly, when the phone cannot keep it', () => {
    storage.failWrites = true
    expect(() => box.enqueue('ana', [fine('f1')])).toThrow(OutboxError)
    expect(box.forUser('ana')).toHaveLength(0)
  })

  it('works on what is stored, so another tab\'s entries are not overwritten', () => {
    const other = createOutbox(storage, 'k', newId)
    box.enqueue('ana', [fine('f1')])
    other.enqueue('ana', [fine('f2')]) // written from a second tab
    box.enqueue('ana', [fine('f3')])
    expect(box.forUser('ana').map((e) => e.op === 'insert' && e.row.id)).toEqual(['f1', 'f2', 'f3'])
  })
})

describe('what enqueue answers, and what is waiting', () => {
  it('returns the ids of the entries it made', () => {
    const ids = box.enqueue('ana', [fine('f1'), fine('f2')])
    expect(ids).toEqual(box.forUser('ana').map((e) => e.id))
  })

  it('returns the id of the unsent entry a cancel was folded into', () => {
    const [created] = box.enqueue('ana', [fine('f1')])
    expect(box.enqueue('ana', [{ op: 'cancel', rowId: 'f1', cancelled: true }])).toEqual([created])
  })

  it('returns nothing when a delete cancels an entry that never left the phone', () => {
    box.enqueue('ana', [fine('f1')])
    expect(box.enqueue('ana', [{ op: 'delete', table: 'fines', rowId: 'f1' }])).toEqual([])
  })

  it('does not count a refused entry as waiting, but still keeps it', async () => {
    box.enqueue('ana', [fine('f1')])
    expect(box.hasWaiting('ana')).toBe(true)
    await box.flush('ana', async () => { throw new Error('no') }, () => false)
    expect(box.hasWaiting('ana')).toBe(false)
    expect(box.hasEntries('ana')).toBe(true)
  })
})

describe('flush', () => {
  const retryable = (e: unknown) => e instanceof TypeError
  const ids = (e: Entry[]) => e.map((x) => (x.op === 'insert' ? x.row.id : x.op === 'delete' ? x.rowId : x.rowId))

  it('sends oldest first and empties the queue', async () => {
    box.enqueue('ana', [fine('f1'), fine('f2'), { op: 'delete', table: 'payments', rowId: 'p9' }])
    const sent: string[] = []
    const result = await box.flush('ana', async (e) => void sent.push(ids([e])[0]), retryable)
    expect(sent).toEqual(['f1', 'f2', 'p9'])
    expect(result).toEqual({ sent: 3, failed: 0, stopped: false })
    expect(box.forUser('ana')).toHaveLength(0)
  })

  it('stops when the server cannot be reached and keeps the rest', async () => {
    box.enqueue('ana', [fine('f1'), fine('f2'), fine('f3')])
    let calls = 0
    const result = await box.flush('ana', async () => {
      if (++calls === 2) throw new TypeError('Failed to fetch')
    }, retryable)
    expect(result).toEqual({ sent: 1, failed: 0, stopped: true })
    expect(ids(box.forUser('ana'))).toEqual(['f2', 'f3'])
  })

  it('marks an entry the server refuses, skips it, and goes on', async () => {
    box.enqueue('ana', [fine('f1'), fine('f2')])
    const result = await box.flush('ana', async (e) => {
      if (e.op === 'insert' && e.row.id === 'f1') throw new Error('violates foreign key')
    }, retryable)
    expect(result).toEqual({ sent: 1, failed: 1, stopped: false })
    const [left] = box.forUser('ana')
    expect(left.failed).toBe('violates foreign key')
  })

  it('does not send a refused entry again until it is retried', async () => {
    box.enqueue('ana', [fine('f1')])
    await box.flush('ana', async () => { throw new Error('no') }, retryable)
    let calls = 0
    await box.flush('ana', async () => void calls++, retryable)
    expect(calls).toBe(0)
    box.retry(box.forUser('ana')[0].id)
    await box.flush('ana', async () => void calls++, retryable)
    expect(calls).toBe(1)
    expect(box.forUser('ana')).toHaveLength(0)
  })

  it('only sends the signed-in user\'s entries', async () => {
    box.enqueue('ana', [fine('f1')])
    box.enqueue('bia', [fine('f2')])
    const sent: string[] = []
    await box.flush('ana', async (e) => void sent.push(ids([e])[0]), retryable)
    expect(sent).toEqual(['f1'])
    expect(box.forUser('bia')).toHaveLength(1)
  })

  it('discard drops an entry for good', () => {
    box.enqueue('ana', [fine('f1')])
    box.discard(box.forUser('ana')[0].id)
    expect(box.forUser('ana')).toHaveLength(0)
  })
})

describe('isRetryable', () => {
  it('retries when the server could not be reached or had a gateway problem', () => {
    expect(isRetryable(new TypeError('Failed to fetch'))).toBe(true)
    expect(isRetryable(new ApiError('TypeError: Failed to fetch', '', 0))).toBe(true)
    expect(isRetryable(new ApiError('Load failed', '', 0))).toBe(true)
    expect(isRetryable(new ApiError('bad gateway', '', 502))).toBe(true)
    expect(isRetryable(new ApiError('JWT expired', 'PGRST301', 401))).toBe(true)
  })

  it('does not retry when the server answered no', () => {
    expect(isRetryable(new ApiError('violates foreign key constraint', '23503', 409))).toBe(false)
    expect(isRetryable(new ApiError('permission denied', '42501', 403))).toBe(false)
    expect(isRetryable(new ApiError('new row violates check constraint', '23514', 400))).toBe(false)
    expect(isRetryable(new Error('something else'))).toBe(false)
  })
})

describe('explainRefusal', () => {
  it('puts the usual refusals in plain Portuguese and keeps the code', () => {
    const e = explainRefusal(new ApiError('insert or update on table "payments" violates foreign key constraint "payments_player_id_fkey"', '23503', 409))
    expect(e.message).toBe('O jogador ou o tipo de multa desta linha já não existe.')
    expect(e.code).toBe('23503')
    expect(explainRefusal(new ApiError('permission denied', '42501', 403)).message).toMatch(/Sem permissão/)
    expect(explainRefusal(new ApiError('duplicate key', '23505', 409)).message).toMatch(/Já existe/)
    expect(explainRefusal(new ApiError('check violation', '23514', 400)).message).toBe('Valor inválido.')
  })

  it('keeps the server\'s own words for anything it does not know', () => {
    expect(explainRefusal(new ApiError('something odd', '99999', 400)).message).toBe('something odd')
  })
})
