import { FunctionsHttpError } from '@supabase/supabase-js'
import { ApiError } from './errors'
import { passwordErrorMessage } from './password'
import { supabase } from './supabase'
import { submit } from './sync'
import { newUuid } from './uuid'
import type {
  AdminUser, ArchivedFineType, Change, ArchivedPlayer, ArchivedSeason, Balance, Expense, FineType, Income, LedgerFilter, LedgerRow, Payment, Role, Settings, Summary,
} from './types'

async function run<T>(q: PromiseLike<{ data: T | null; error: { message: string; code?: string } | null; status?: number }>): Promise<T> {
  const { data, error, status } = await q
  if (error) throw new ApiError(error.message, error.code ?? '', status ?? 0)
  return data as T
}

// --- reads (open to everyone) ---

export const getSummary = () =>
  run<Summary>(supabase.from('club_summary').select('*').single())

export const getBalances = () =>
  run<Balance[]>(supabase.from('player_balance').select('*').order('name'))

export const getFineTypes = () =>
  run<FineType[]>(supabase.from('fine_types').select('*').order('name'))

export const DEFAULT_SEASON = '2026/27'

export async function getSettings(): Promise<Settings> {
  const { data, error } = await supabase.from('settings').select('late_fine_amount, due_day, season').single()
  if (!error) return data as Settings
  // 42703 = undefined column: the database has not had the season migration yet.
  // Keep the app working (with the default season) instead of failing every page.
  if (error.code === '42703') {
    const old = await supabase.from('settings').select('late_fine_amount, due_day').single()
    if (old.error) throw new Error(old.error.message)
    return { ...(old.data as Omit<Settings, 'season'>), season: DEFAULT_SEASON }
  }
  throw new Error(error.message)
}

export function getLedger(f: LedgerFilter = {}) {
  let q = supabase.from('fine_ledger').select('*')
  if (f.playerId) q = q.eq('player_id', f.playerId)
  if (f.fineTypeId) q = q.eq('fine_type_id', f.fineTypeId)
  if (f.status) q = q.eq('status', f.status)
  if (f.from) q = q.gte('fined_on', f.from)
  if (f.to) q = q.lte('fined_on', f.to)
  return run<LedgerRow[]>(q.order('fined_on', { ascending: false }).order('seq', { ascending: false }))
}

export const getPayments = (playerId?: string) => {
  let q = supabase.from('payments').select('*')
  if (playerId) q = q.eq('player_id', playerId)
  return run<Payment[]>(q.order('paid_on', { ascending: false }).order('created_at', { ascending: false }))
}

export const getIncomes = () =>
  run<Income[]>(supabase.from('incomes').select('*').order('received_on', { ascending: false }))

export const getExpenses = () =>
  run<Expense[]>(supabase.from('expenses').select('*').order('spent_on', { ascending: false }))

// --- writes (admins only; enforced by row level security) ---

export interface NewFines {
  playerIds: string[]
  fineTypeId: string
  amount: number
  finedOn: string
  description?: string
}

// The day-to-day money entries below go through `submit`: straight to the server when it can be
// reached, otherwise saved on the phone and sent later (see lib/sync.ts). Every new row gets its id
// here, so sending it twice can never create it twice.
const newId = newUuid

export const addFines = (n: NewFines) =>
  submit(
    n.playerIds.map((player_id) => ({
      op: 'insert' as const,
      table: 'fines' as const,
      row: {
        id: newId(),
        player_id,
        fine_type_id: n.fineTypeId,
        amount: n.amount,
        fined_on: n.finedOn,
        description: n.description?.trim() || null,
      },
    })),
  )

export const setFineCancelled = (id: string, cancelled: boolean) => submit([{ op: 'cancel', rowId: id, cancelled }])

export const deleteFine = (id: string) => submit([{ op: 'delete', table: 'fines', rowId: id }])

export const addPayment = (p: Omit<Payment, 'id' | 'note' | 'sync'> & { note?: string }) =>
  submit([{ op: 'insert', table: 'payments', row: { id: newId(), ...p, note: p.note?.trim() || null } }])

export const deletePayment = (id: string) => submit([{ op: 'delete', table: 'payments', rowId: id }])

export const addIncome = (i: Omit<Income, 'id' | 'sync'>) =>
  submit([{ op: 'insert', table: 'incomes', row: { id: newId(), ...i } }])
export const deleteIncome = (id: string) => submit([{ op: 'delete', table: 'incomes', rowId: id }])

export const addExpense = (e: Omit<Expense, 'id' | 'sync'>) =>
  submit([{ op: 'insert', table: 'expenses', row: { id: newId(), ...e } }])
export const deleteExpense = (id: string) => submit([{ op: 'delete', table: 'expenses', rowId: id }])

export const saveFineType = (t: Partial<FineType> & Pick<FineType, 'name' | 'default_amount'>) =>
  run(supabase.from('fine_types').upsert(t))

export const savePlayer = (p: { id?: string; name: string; role: Role; active: boolean }) =>
  run(supabase.from('players').upsert(p))

export const saveSettings = (s: Settings) =>
  run(supabase.from('settings').update(s).eq('singleton', true))

/** Adds the late fees that are due. Returns how many were created. */
export const applyLateFees = () => run<number>(supabase.rpc('apply_late_fees_admin'))

// --- admin management ---

export const listAdmins = () => run<AdminUser[]>(supabase.rpc('list_admins'))

export const removeAdmin = (userId: string) => run(supabase.rpc('remove_admin', { p_user_id: userId }))

/**
 * Emails an invitation and makes the person an admin.
 * The invitation stays pending until the person first signs in or chooses a password.
 * 'invited' = a new invitation email; 'resent' = they already had an account whose invitation is
 * still pending, so they were sent a fresh access code; 'already_admin' = nothing to send.
 */
export async function inviteAdmin(email: string): Promise<'invited' | 'resent' | 'already_admin'> {
  const { data, error } = await supabase.functions.invoke('invite-admin', {
    body: { email, redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}set-password` },
  })
  if (error) {
    let message = error.message
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null)
      if (body?.error) message = body.error
    }
    throw new Error(message)
  }
  return data.status
}

// --- first access / forgotten password (no login needed, works from a code in an email) ---

/** The emailed code is single-use per type; which type applies depends on how the account was created. */
const CODE_TYPES = ['email', 'signup', 'invite', 'recovery'] as const

/**
 * Emails an access code. Whether the address belongs to an invited person is never revealed:
 * an unknown address looks exactly like a known one. Real failures (rate limit, mail down) are shown.
 */
export async function requestAccessCode(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}set-password` },
  })
  if (!error) return
  if (error.code === 'otp_disabled' || error.code === 'user_not_found' || error.code === 'signup_disabled') return
  if (error.status === 429 || error.code === 'over_email_send_rate_limit' || error.code === 'over_request_rate_limit')
    throw new Error('Aguarde um minuto antes de pedir outro código.')
  throw new Error('Não foi possível enviar o código. Tente de novo daqui a pouco.')
}

/** Signs in with the emailed code, then stores the chosen password so next time a normal login works. */
export async function finishAccess(email: string, code: string, password: string): Promise<void> {
  const token = code.replace(/\s/g, '')
  let verified = false
  for (const type of CODE_TYPES) {
    const { data, error } = await supabase.auth.verifyOtp({ email: email.trim(), token, type })
    if (!error && data.session) {
      verified = true
      break
    }
  }
  if (!verified) throw new Error('Código inválido ou expirado. Se já abriu a ligação do mesmo email, o código deixou de valer: peça um código novo.')
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw new Error(passwordErrorMessage(error))
}

// --- the record of changes ---

export const listChanges = (limit = 300) => run<Change[]>(supabase.rpc('list_changes', { p_limit: limit }))

/** Puts a deleted row back exactly as it was. */
export const restoreChange = (id: number) => run(supabase.rpc('restore_change', { p_id: id }))

// --- deleting (only allowed while nothing depends on the row) ---

const inUse = (message: string, friendly: string) => {
  if (/foreign key|23503/i.test(message)) throw new Error(friendly)
  throw new Error(message)
}

export const deletePlayer = (id: string) =>
  run(supabase.from('players').delete().eq('id', id)).catch((e: Error) =>
    inUse(e.message, 'Este jogador tem multas ou pagamentos. Marque-o como inativo, ou feche a época e apague-o depois.'))

export const deleteFineType = (id: string) =>
  run(supabase.from('fine_types').delete().eq('id', id)).catch((e: Error) =>
    inUse(e.message, 'Este tipo de multa já foi usado em multas. Marque-o como inativo, ou feche a época e apague-o depois.'))

// --- seasons ---

/** Archives the current season, clears fines/payments/income/expenses and starts `next`. */
export const closeSeason = (next: string) => run<string>(supabase.rpc('close_season', { p_next_season: next }))

export async function getArchivedSeasons(): Promise<ArchivedSeason[]> {
  const { data, error } = await supabase.from('season_archive').select('*').order('closed_at', { ascending: false })
  // PGRST205 / 42P01: the archive table does not exist (season migration not run yet): nothing is archived
  if (error && (error.code === 'PGRST205' || error.code === '42P01')) return []
  if (error) throw new Error(error.message)
  return data as ArchivedSeason[]
}

export const getArchivedPlayers = (archiveId: string) =>
  run<ArchivedPlayer[]>(supabase.from('season_archive_players').select('*').eq('archive_id', archiveId).order('total_fined', { ascending: false }))

export const getArchivedFineTypes = (archiveId: string) =>
  run<ArchivedFineType[]>(supabase.from('season_archive_types').select('*').eq('archive_id', archiveId).order('total_amount', { ascending: false }))

export const deleteArchivedSeason = (id: string) => run(supabase.from('season_archive').delete().eq('id', id))
