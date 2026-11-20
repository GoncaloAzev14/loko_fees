/**
 * The outbox: changes an admin made while the server could not be reached, kept on the phone until
 * they can be sent. Pure logic over an injected storage, so it can be tested without a browser.
 *
 * Every entry is one of three things, in the order it happened:
 *   insert  a new row (it carries its own id, so sending it twice cannot create it twice)
 *   delete  remove a row
 *   cancel  mark a fine cancelled or restore it
 *
 * Only the day-to-day money entries go through here: fines, payments, income and expenses.
 */

import { newUuid } from './uuid'

export type Table = 'fines' | 'payments' | 'incomes' | 'expenses'

export type Draft =
  | { op: 'insert'; table: Table; row: { id: string } & Record<string, unknown> }
  | { op: 'delete'; table: Table; rowId: string }
  | { op: 'cancel'; rowId: string; cancelled: boolean }

export type Entry = Draft & {
  id: string
  /** The signed-in user who made it. Only that user's session sends it. */
  uid: string
  at: number
  /** Set when the server refused it for good. It stays here, marked, until someone decides. */
  failed?: string
}

export interface Storage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface FlushResult {
  sent: number
  failed: number
  /** True when it stopped because the server could not be reached; the rest is still queued. */
  stopped: boolean
}

export const OUTBOX_KEY = 'loko.outbox.v1'

/** Raised when an entry cannot be kept on the phone, so the person is told instead of losing it silently. */
export class OutboxError extends Error {}

export function createOutbox(storage: Storage, key = OUTBOX_KEY, newId: () => string = newUuid) {
  let raw: string | null = storage.getItem(key)
  let entries: Entry[] = parse(raw)
  const listeners = new Set<() => void>()

  function parse(text: string | null): Entry[] {
    try {
      const parsed = JSON.parse(text ?? '[]')
      return Array.isArray(parsed) ? (parsed as Entry[]) : []
    } catch {
      return []
    }
  }

  function write(next: Entry[]) {
    const text = JSON.stringify(next)
    try {
      storage.setItem(key, text)
    } catch {
      throw new OutboxError('Não foi possível guardar no telemóvel. Verifique o espaço ou as definições do navegador.')
    }
    raw = text
    entries = next
    listeners.forEach((l) => l())
  }

  /**
   * Another tab or window may have changed the queue; work on what is stored, not on a stale copy.
   * The array is only replaced when the stored text changed, so screens reading it see a stable value.
   */
  const fresh = () => {
    const stored = storage.getItem(key)
    if (stored !== raw) {
      raw = stored
      entries = parse(stored)
    }
    return entries
  }

  const sameRow = (e: Entry, table: Table | null, rowId: string) =>
    e.op === 'insert' ? (table === null || e.table === table) && e.row.id === rowId
    : e.op === 'delete' ? (table === null || e.table === table) && e.rowId === rowId
    : e.rowId === rowId

  return {
    all: () => entries,
    forUser: (uid: string) => entries.filter((e) => e.uid === uid),
    hasEntries: (uid: string) => fresh().some((e) => e.uid === uid),
    /** Entries still to be sent. One the server refused is not waiting: it never holds up what comes after it. */
    hasWaiting: (uid: string) => fresh().some((e) => e.uid === uid && !e.failed),
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    /** Re-reads the storage; for when another tab changed it. */
    reload() {
      fresh()
      listeners.forEach((l) => l())
    },

    /**
     * Adds changes to the queue, folding them into what is already waiting:
     * deleting something that was never sent just cancels it, cancelling something that was never sent
     * edits it, and a later cancel replaces an earlier one for the same fine.
     */
    enqueue(uid: string, drafts: Draft[]): string[] {
      let next = [...fresh()]
      const ids: string[] = [] // the entries that now stand for what was asked, so the caller can follow them
      const add = (d: Draft) => {
        const entry = { ...d, id: newId(), uid, at: Date.now() } as Entry
        next.push(entry)
        ids.push(entry.id)
      }
      for (const d of drafts) {
        if (d.op === 'insert') {
          add(d)
        } else if (d.op === 'delete') {
          const unsent = next.find((e) => e.uid === uid && e.op === 'insert' && e.table === d.table && e.row.id === d.rowId)
          next = next.filter((e) => !(e.uid === uid && sameRow(e, null, d.rowId) && (e.op === 'cancel' || e === unsent)))
          const already = next.find((e) => e.uid === uid && e.op === 'delete' && e.table === d.table && e.rowId === d.rowId)
          if (already) ids.push(already.id)
          else if (!unsent) add(d) // an unsent row that is deleted simply never existed: nothing to follow
        } else {
          const unsent = next.find((e) => e.uid === uid && e.op === 'insert' && e.table === 'fines' && e.row.id === d.rowId)
          if (unsent && unsent.op === 'insert') {
            next = next.map((e) => (e === unsent && e.op === 'insert' ? { ...e, row: { ...e.row, cancelled: d.cancelled } } : e))
            ids.push(unsent.id)
          } else {
            next = next.filter((e) => !(e.uid === uid && e.op === 'cancel' && e.rowId === d.rowId))
            add(d)
          }
        }
      }
      write(next)
      return ids
    },

    remove(id: string) {
      write(fresh().filter((e) => e.id !== id))
    },
    markFailed(id: string, message: string) {
      write(fresh().map((e) => (e.id === id ? { ...e, failed: message } : e)))
    },
    /** Put a refused entry back in line to be sent again. */
    retry(id: string) {
      write(fresh().map((e) => (e.id === id ? { ...e, failed: undefined } : e)))
    },
    discard(id: string) {
      write(fresh().filter((e) => e.id !== id))
    },

    /**
     * Sends the user's waiting entries one by one, oldest first. Sent ones leave the queue. One the
     * server refuses for good is marked failed and skipped. If the server cannot be reached it stops
     * and keeps the rest for next time.
     */
    async flush(uid: string, send: (entry: Entry) => Promise<void>, retryable: (error: unknown) => boolean): Promise<FlushResult> {
      const result: FlushResult = { sent: 0, failed: 0, stopped: false }
      for (const entry of fresh().filter((e) => e.uid === uid && !e.failed)) {
        try {
          await send(entry)
          this.remove(entry.id)
          result.sent++
        } catch (error) {
          if (retryable(error)) {
            result.stopped = true
            break
          }
          this.markFailed(entry.id, error instanceof Error ? error.message : 'Erro inesperado')
          result.failed++
        }
      }
      return result
    },
  }
}

export type Outbox = ReturnType<typeof createOutbox>

/** localStorage when it works; otherwise nothing is kept, and enqueue says so. */
export function browserStorage(): Storage {
  return {
    getItem: (k) => {
      try {
        return localStorage.getItem(k)
      } catch {
        return null
      }
    },
    setItem: (k, v) => localStorage.setItem(k, v), // may throw: createOutbox turns that into an OutboxError
  }
}
