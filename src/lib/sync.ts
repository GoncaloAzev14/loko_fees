import { supabase } from './supabase'
import { ApiError, explainRefusal, isRetryable } from './errors'
import { storedSession } from './offlineAuth'
import { browserStorage, createOutbox, type Draft, type Entry, type FlushResult } from './outbox'

/** The queue of changes waiting to be sent. One per browser. */
export const outbox = createOutbox(browserStorage())

export const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false

// --- status the screen shows: is a sync running, and did the last try fail to reach the server ---

interface Status {
  syncing: boolean
  /** The last attempt could not reach the server, even if the phone thinks it is online. */
  unreachable: boolean
}
let status: Status = { syncing: false, unreachable: false }
const statusListeners = new Set<() => void>()
function setStatus(patch: Partial<Status>) {
  if (Object.entries(patch).every(([k, v]) => status[k as keyof Status] === v)) return
  status = { ...status, ...patch }
  statusListeners.forEach((l) => l())
}
export const getSyncStatus = () => status
export function subscribeSyncStatus(listener: () => void) {
  statusListeners.add(listener)
  return () => void statusListeners.delete(listener)
}

const flushedListeners = new Set<(r: FlushResult) => void>()
/** Called after a sync changed something on the server, so screens can refetch. */
export function onFlushed(listener: (r: FlushResult) => void) {
  flushedListeners.add(listener)
  return () => void flushedListeners.delete(listener)
}

// --- who is signed in ---

/** The signed-in user's id, even when Supabase has no live session because it cannot refresh offline. */
async function currentUid(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? storedSession()?.user.id ?? null
}

/** True only with a real, usable session. Without one a request would go out as a visitor and be refused. */
async function hasLiveSession(): Promise<boolean> {
  const { data } = await supabase.auth.getSession()
  return Boolean(data.session)
}

// --- sending ---

async function check(result: PromiseLike<{ error: { message: string; code?: string } | null; status?: number }>) {
  const { error, status: http } = await result
  if (error) throw new ApiError(error.message, error.code ?? '', http ?? 0)
}

/** Insert by id and ignore a row that is already there: sending the same entry twice makes one row. */
const sendInserts = (table: string, rows: object[]) =>
  check(supabase.from(table).upsert(rows, { onConflict: 'id', ignoreDuplicates: true }))

const sendOne = (d: Draft) =>
  d.op === 'insert' ? sendInserts(d.table, [d.row])
  : d.op === 'delete' ? check(supabase.from(d.table).delete().eq('id', d.rowId))
  : check(supabase.from('fines').update({ cancelled: d.cancelled }).eq('id', d.rowId))

/** Sends changes in order, grouping neighbouring inserts into one request. `onSent` counts what got through. */
async function sendAll(drafts: Draft[], onSent: (n: number) => void) {
  let i = 0
  while (i < drafts.length) {
    const d = drafts[i]
    if (d.op === 'insert') {
      let j = i
      while (j < drafts.length && drafts[j].op === 'insert' && (drafts[j] as typeof d).table === d.table) j++
      await sendInserts(d.table, drafts.slice(i, j).map((x) => (x as typeof d).row))
      onSent(j - i)
      i = j
    } else {
      await sendOne(d)
      onSent(1)
      i++
    }
  }
}

/**
 * Makes changes. With a connection and nothing waiting, they go straight to the server and a refusal
 * is an error the person sees. Offline, or if the server cannot be reached, or if older changes are
 * still waiting (so order is kept), they are saved on the phone to be sent later.
 */
/** What saving answered: straight to the server, or kept on the phone (and which entries stand for it). */
export interface SubmitResult {
  queued: boolean
  ids: string[]
}

export async function submit(drafts: Draft[]): Promise<SubmitResult> {
  const uid = await currentUid()
  if (!uid) {
    await sendAll(drafts, () => {}) // not signed in: the server says no, in its own words
    return { queued: false, ids: [] }
  }
  if (isOffline() || outbox.hasWaiting(uid) || !(await hasLiveSession())) {
    const ids = outbox.enqueue(uid, drafts)
    void flush()
    return { queued: true, ids }
  }
  let sent = 0
  try {
    await sendAll(drafts, (n) => (sent += n))
    setStatus({ unreachable: false })
    return { queued: false, ids: [] }
  } catch (error) {
    if (!isRetryable(error)) throw error
    setStatus({ unreachable: true })
    return { queued: true, ids: outbox.enqueue(uid, drafts.slice(sent)) }
  }
}

let running: Promise<FlushResult> | null = null

/** Sends what is waiting for the signed-in user. Safe to call as often as you like. */
export function flush(): Promise<FlushResult> {
  if (running) return running
  running = (async (): Promise<FlushResult> => {
    const idle: FlushResult = { sent: 0, failed: 0, stopped: false }
    const uid = await currentUid()
    if (!uid || isOffline() || !outbox.hasWaiting(uid) || !(await hasLiveSession())) return idle
    setStatus({ syncing: true })
    try {
      // a refusal is stored with words the person can read, not the database's
      const send = (e: Entry) => sendOne(e).catch((error) => { throw error instanceof ApiError && !isRetryable(error) ? explainRefusal(error) : error })
      const result = await outbox.flush(uid, send, isRetryable)
      setStatus({ unreachable: result.stopped })
      if (result.sent > 0 || result.failed > 0) flushedListeners.forEach((l) => l(result))
      return result
    } finally {
      setStatus({ syncing: false })
    }
  })().finally(() => {
    running = null
  })
  return running
}
