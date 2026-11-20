import type { FineType } from './types'

export interface TableEntry {
  key: string
  description: string
  amount: number
}

/** What the late fee is called everywhere else in the app (see labels.ts). */
export const LATE_FEE_NAME = 'Multa de falta de pagamento'

/**
 * Every fine currently being enforced, for the public table: the fine types that are in use (not the inactive
 * ones), in alphabetical order, followed by the automatic late fee when the settings are known.
 */
export function finesInForce(types: FineType[], lateFee?: number | null): TableEntry[] {
  const entries = types
    .filter((t) => t.active)
    .map((t) => ({ key: t.id, description: t.name, amount: t.default_amount }))
    .sort((a, b) => a.description.localeCompare(b.description, 'pt'))
  if (typeof lateFee === 'number') entries.push({ key: 'late-fee', description: LATE_FEE_NAME, amount: lateFee })
  return entries
}
