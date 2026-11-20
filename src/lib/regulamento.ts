import type { FineType } from './types'

export interface RuleEntry {
  key: string
  description: string
  amount: number
  /** A line under the description, when the fine needs explaining. */
  note?: string
  /** false for a rule an admin switched off (only an admin gets to see it then). */
  active?: boolean
}

/** What the page needs to know about the automatic late fee. */
export interface LateFee {
  amount: number
  dueDay: number
  enabled: boolean
}

/** What the late fee is called everywhere else in the app (see labels.ts). */
export const LATE_FEE_NAME = 'Multa de falta de pagamento'

/** Says when the late fee is added, in the words the app uses for an unpaid fine ("vencida"). */
export function lateFeeNote(dueDay: number) {
  return `Quando as multas do mês não estão pagas até ao dia ${dueDay} do mês seguinte, ficam marcadas como vencidas e esta multa é acrescentada.`
}

/** Every fine type, active or not, in alphabetical order: what an admin edits. */
export function sortedTypes(types: FineType[]): FineType[] {
  return [...types].sort((a, b) => a.name.localeCompare(b.name, 'pt'))
}

/** The automatic late fee as a card, or nothing while the settings are not loaded. */
export function lateFeeEntry(lateFee?: LateFee | null): RuleEntry | null {
  return lateFee ? { key: 'late-fee', description: LATE_FEE_NAME, amount: lateFee.amount, note: lateFeeNote(lateFee.dueDay), active: lateFee.enabled } : null
}

/**
 * Every fine currently being enforced, for the public rules: the fine types that are in use (not the inactive
 * ones), in alphabetical order, followed by the automatic late fee when the settings are known and it is switched on.
 */
export function finesInForce(types: FineType[], lateFee?: LateFee | null): RuleEntry[] {
  const entries: RuleEntry[] = sortedTypes(types.filter((t) => t.active)).map((t) => ({ key: t.id, description: t.name, amount: t.default_amount }))
  const late = lateFeeEntry(lateFee)
  if (late?.active) entries.push(late) // switched off: it is not being enforced, so visitors do not see it
  return entries
}
