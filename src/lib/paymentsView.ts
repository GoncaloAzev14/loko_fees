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
