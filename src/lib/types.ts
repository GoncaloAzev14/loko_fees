export type Role = 'player' | 'staff'
export type FineStatus = 'paid' | 'pending' | 'overdue' | 'cancelled'

/**
 * Set on rows the screen shows from the phone's outbox rather than from the server: a new row waiting to
 * be sent, or a change (delete, cancel, restore) to a row that is waiting to be sent.
 */
export type SyncMark = 'queued' | 'deleting' | 'cancelling' | 'restoring'

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
  /** false when an admin switched the automatic late fee off */
  late_fee_enabled: boolean
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
  sync?: SyncMark
}

export interface Payment {
  id: string
  player_id: string
  amount: number
  paid_on: string
  note: string | null
  sync?: SyncMark
}

export interface Income {
  id: string
  player_id: string | null
  amount: number
  received_on: string
  description: string
  sync?: SyncMark
}

export interface Expense {
  id: string
  amount: number
  spent_on: string
  description: string
  sync?: SyncMark
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

/** One line of the permanent record of changes (who did what, and the row before and after). */
export interface Change {
  id: number
  at: string
  /** Null when the system did it: the daily job, or the dashboard. */
  who_email: string | null
  action: 'insert' | 'update' | 'delete'
  table_name: string
  row_id: string | null
  old_row: Record<string, unknown> | null
  new_row: Record<string, unknown> | null
  /** A delete that has not been put back yet. */
  restorable: boolean
}

export interface AdminUser {
  user_id: string
  email: string
  /** Invited but has not chosen a password yet. Missing while the database migration has not been run. */
  pending?: boolean
  /** The club's main admin: cannot be removed. Missing while the database migration has not been run. */
  is_owner?: boolean
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
