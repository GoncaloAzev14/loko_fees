import { describe, expect, it } from 'vitest'
import { groupByMonth } from './paymentsView'

const p = (id: string, paid_on: string, amount: number) => ({ id, paid_on, amount })
const by = (r: { paid_on: string }) => r.paid_on

describe('groupByMonth', () => {
  it('puts every row in a month, in the order given, and leaves none out', () => {
    const rows = [p('a', '2026-11-20', 5), p('b', '2026-11-02', 2), p('c', '2026-10-31', 3), p('d', '2026-10-01', 1), p('e', '2026-09-15', 4)]
    const groups = groupByMonth(rows, by)
    expect(groups.map((g) => g.key)).toEqual(['2026-11', '2026-10', '2026-09'])
    expect(groups.map((g) => g.rows.map((r) => r.id))).toEqual([['a', 'b'], ['c', 'd'], ['e']])
    expect(groups.flatMap((g) => g.rows)).toHaveLength(rows.length)
  })

  it('totals each month', () => {
    const groups = groupByMonth([p('a', '2026-11-20', 5), p('b', '2026-11-02', 2.5), p('c', '2026-10-31', 3)], by)
    expect(groups.map((g) => g.total)).toEqual([7.5, 3])
  })

  it('names the month in Portuguese, capitalised', () => {
    const [g] = groupByMonth([p('a', '2026-11-20', 5)], by)
    expect(g.label).toBe('Novembro de 2026')
    expect(groupByMonth([p('a', '2026-03-02', 1)], by)[0].label).toBe('Março de 2026')
  })

  it('has nothing for nothing', () => {
    expect(groupByMonth([], by)).toEqual([])
  })

  it('handles a large list without losing any', () => {
    const rows = Array.from({ length: 400 }, (_, i) => p(`r${i}`, `2026-${String(1 + (i % 12)).padStart(2, '0')}-15`, 1)).sort((a, b) => b.paid_on.localeCompare(a.paid_on))
    expect(groupByMonth(rows, by).flatMap((g) => g.rows)).toHaveLength(400)
  })
})
