import { parseDate } from './format'

export interface MonthGroup<T> {
  /** '2026-11' */
  key: string
  /** 'Novembro de 2026' */
  label: string
  rows: T[]
  total: number
}

const month = new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric' })

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * Splits dated money rows into months, keeping the order they came in (newest first stays newest first),
 * with the month's total. Every row ends up in exactly one group: nothing is left out.
 */
export function groupByMonth<T extends { amount: number }>(rows: T[], dateOf: (row: T) => string): MonthGroup<T>[] {
  const groups: MonthGroup<T>[] = []
  for (const row of rows) {
    const iso = dateOf(row)
    const key = iso.slice(0, 7)
    let g = groups[groups.length - 1]
    if (!g || g.key !== key) {
      g = { key, label: capitalise(month.format(parseDate(iso))).replace(' De ', ' de '), rows: [], total: 0 }
      groups.push(g)
    }
    g.rows.push(row)
    g.total += row.amount
  }
  return groups
}

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
