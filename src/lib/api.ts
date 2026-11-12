import { supabase } from './supabase'
import type {
  Balance, Expense, FineType, Income, LedgerFilter, LedgerRow, Payment, Role, Settings, Summary,
} from './types'

async function run<T>(q: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data as T
}

// --- reads (open to everyone) ---

export const getSummary = () =>
  run<Summary>(supabase.from('club_summary').select('*').single())

export const getBalances = () =>
  run<Balance[]>(supabase.from('player_balance').select('*').order('name'))

export const getFineTypes = () =>
  run<FineType[]>(supabase.from('fine_types').select('*').order('name'))

export const getSettings = () =>
  run<Settings>(supabase.from('settings').select('late_fine_amount, due_day').single())

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

export const addFines = (n: NewFines) =>
  run(supabase.from('fines').insert(
    n.playerIds.map((player_id) => ({
      player_id,
      fine_type_id: n.fineTypeId,
      amount: n.amount,
      fined_on: n.finedOn,
      description: n.description?.trim() || null,
    })),
  ))

export const setFineCancelled = (id: string, cancelled: boolean) =>
  run(supabase.from('fines').update({ cancelled }).eq('id', id))

export const deleteFine = (id: string) => run(supabase.from('fines').delete().eq('id', id))

export const addPayment = (p: Omit<Payment, 'id' | 'note'> & { note?: string }) =>
  run(supabase.from('payments').insert({ ...p, note: p.note?.trim() || null }))

export const deletePayment = (id: string) => run(supabase.from('payments').delete().eq('id', id))

export const addIncome = (i: Omit<Income, 'id'>) => run(supabase.from('incomes').insert(i))
export const deleteIncome = (id: string) => run(supabase.from('incomes').delete().eq('id', id))

export const addExpense = (e: Omit<Expense, 'id'>) => run(supabase.from('expenses').insert(e))
export const deleteExpense = (id: string) => run(supabase.from('expenses').delete().eq('id', id))

export const saveFineType = (t: Partial<FineType> & Pick<FineType, 'name' | 'default_amount'>) =>
  run(supabase.from('fine_types').upsert(t))

export const savePlayer = (p: { id?: string; name: string; role: Role; active: boolean }) =>
  run(supabase.from('players').upsert(p))

export const saveSettings = (s: Settings) =>
  run(supabase.from('settings').update(s).eq('singleton', true))

/** Adds the late fees that are due. Returns how many were created. */
export const applyLateFees = () => run<number>(supabase.rpc('apply_late_fees_admin'))
