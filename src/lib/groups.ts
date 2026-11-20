import { formatDateLong, parseDate } from './format'

export type GroupBy = 'day' | 'month'

export interface Group<T> {
  /** '2026-11-06' for a day, '2026-11' for a month */
  key: string
  /** 'Sexta-feira, 6 de novembro' / 'Novembro de 2026' */
  label: string
  rows: T[]
  total: number
}

const monthName = new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric' })
const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * Splits dated rows into days or months, keeping the order they came in (newest first stays newest first),
 * with the group's total (0 when no amount is given). Every row ends up in exactly one group: none is left out.
 */
export function groupRows<T>(rows: T[], dateOf: (row: T) => string, by: GroupBy, amountOf?: (row: T) => number): Group<T>[] {
  const groups: Group<T>[] = []
  for (const row of rows) {
    const iso = dateOf(row)
    const key = by === 'day' ? iso.slice(0, 10) : iso.slice(0, 7)
    let g = groups[groups.length - 1]
    if (!g || g.key !== key) {
      const label = by === 'day' ? capitalise(formatDateLong(iso.slice(0, 10))) : capitalise(monthName.format(parseDate(iso))).replace(' De ', ' de ')
      g = { key, label, rows: [], total: 0 }
      groups.push(g)
    }
    g.rows.push(row)
    g.total += amountOf?.(row) ?? 0
  }
  return groups
}
