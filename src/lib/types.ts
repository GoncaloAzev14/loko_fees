export type Role = 'player' | 'staff'
export type FineStatus = 'paid' | 'pending' | 'overdue' | 'cancelled'

export interface Balance {
  player_id: string
  name: string
  role: Role
  active: boolean
  total_fined: number
  total_paid: number
  outstanding: number
  credit: number
  overdue: number
}

export interface FineType {
  id: string
  name: string
  default_amount: number
  active: boolean
}

export interface Settings {
  late_fine_amount: number
  due_day: number
  /** e.g. '2026/27' */
  season: string
}

export interface LedgerRow {
  id: string
  seq: number
  player_id: string
  fine_type_id: string | null
  kind: 'fine' | 'late_fee'
  amount: number
  fined_on: string
  description: string | null
  late_for_month: string | null
  cancelled: boolean
  due_on: string
  paid_amount: number
  remaining: number
  status: FineStatus
}

export interface Payment {
  id: string
  player_id: string
  amount: number
  paid_on: string
  note: string | null
}

export interface Income {
  id: string
  player_id: string | null
  amount: number
  received_on: string
  description: string
}

export interface Expense {
  id: string
  amount: number
  spent_on: string
  description: string
}

export interface Summary {
  total_in: number
  total_out: number
  box: number
  total_outstanding: number
  total_overdue: number
  total_credit: number
}

export interface LedgerFilter {
  playerId?: string
  fineTypeId?: string
  status?: FineStatus
  from?: string
  to?: string
}

export interface AdminUser {
  user_id: string
  email: string
  /** Invited but has not chosen a password yet. Missing while the database migration has not been run. */
  pending?: boolean
}

export interface ArchivedSeason {
  id: string
  season: string
  closed_at: string
  fines_count: number
  total_fined: number
  total_paid: number
  total_outstanding: number
  total_credit: number
  total_income: number
  total_expenses: number
  box: number
}

export interface ArchivedPlayer {
  player_name: string
  role: Role
  fines_count: number
  total_fined: number
  total_paid: number
  outstanding: number
  credit: number
}

export interface ArchivedFineType {
  fine_type: string
  fines_count: number
  total_amount: number
}
