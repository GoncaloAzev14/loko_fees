import { groupRows, type Group } from './groups'

export type MonthGroup<T> = Group<T>

/** Payments (or any dated money rows) split into months, newest first, with each month's total. */
export const groupByMonth = <T extends { amount: number }>(rows: T[], dateOf: (row: T) => string): MonthGroup<T>[] =>
  groupRows(rows, dateOf, 'month', (r) => r.amount)

/** Lower case and no accents, so "aurelio" finds "Aurélio" and "outubro" finds "Outubro". */
export const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** The ways an amount might be typed: 5, 5.00 and 5,00 all find a payment of five euros. */
const amountForms = (n: number) => [String(n), n.toFixed(2), n.toFixed(2).replace('.', ',')]

/**
 * Does this payment match what was typed in the search box? Every word typed must be found somewhere in
 * the payment: the player's name, the note, the amount, the date (as 06/11/2026 or 2026-11-06) or the
 * month's name. Empty search matches everything.
 */
export function matchesQuery(
  payment: { amount: number; paid_on: string; note: string | null },
  playerName: string,
  monthLabel: string,
  formattedDate: string,
  query: string,
): boolean {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const haystack = normalize([playerName, payment.note ?? '', ...amountForms(payment.amount), formattedDate, payment.paid_on, monthLabel].join(' '))
  return words.every((w) => haystack.includes(w))
}
