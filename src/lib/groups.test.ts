import { describe, expect, it } from 'vitest'
import { groupRows } from './groups'

const r = (id: string, date: string, amount = 1) => ({ id, date, amount })
const by = (x: { date: string }) => x.date

describe('groupRows by day', () => {
  const rows = [r('a', '2026-11-06', 5), r('b', '2026-11-06', 2), r('c', '2026-11-03', 3), r('d', '2026-10-31', 1)]

  it('puts the rows of one day together, in the order given, leaving none out', () => {
    const groups = groupRows(rows, by, 'day')
    expect(groups.map((g) => g.key)).toEqual(['2026-11-06', '2026-11-03', '2026-10-31'])
    expect(groups.map((g) => g.rows.map((x) => x.id))).toEqual([['a', 'b'], ['c'], ['d']])
    expect(groups.flatMap((g) => g.rows)).toHaveLength(rows.length)
  })

  it('names the day in Portuguese, with a capital', () => {
    expect(groupRows(rows, by, 'day')[0].label).toBe('Sexta-feira, 6 de novembro')
  })

  it('totals each day when an amount is given, and says 0 when it is not', () => {
    expect(groupRows(rows, by, 'day', (x) => x.amount).map((g) => g.total)).toEqual([7, 3, 1])
    expect(groupRows(rows, by, 'day').map((g) => g.total)).toEqual([0, 0, 0])
  })

  it('accepts full timestamps as well as dates', () => {
    expect(groupRows([r('a', '2026-11-06T23:59:00')], by, 'day')[0].key).toBe('2026-11-06')
  })
})

describe('groupRows by month', () => {
  it('splits into months and names them', () => {
    const groups = groupRows([r('a', '2026-11-20'), r('b', '2026-11-02'), r('c', '2026-10-31')], by, 'month')
    expect(groups.map((g) => [g.key, g.label, g.rows.length])).toEqual([['2026-11', 'Novembro de 2026', 2], ['2026-10', 'Outubro de 2026', 1]])
  })

  it('sums negative amounts too, so a month of money in and out nets out', () => {
    const [g] = groupRows([r('a', '2026-11-20', 10), r('b', '2026-11-02', -4)], by, 'month', (x) => x.amount)
    expect(g.total).toBe(6)
  })
})

describe('groupRows in general', () => {
  it('has nothing for nothing', () => {
    expect(groupRows([], by, 'day')).toEqual([])
  })

  it('never loses a row, however many there are', () => {
    const many = Array.from({ length: 1000 }, (_, i) => r(`r${i}`, `2026-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`)).sort((a, b) => b.date.localeCompare(a.date))
    for (const mode of ['day', 'month'] as const) expect(groupRows(many, by, mode).flatMap((g) => g.rows)).toHaveLength(1000)
  })

  it('groups neighbours only, so the caller keeps the list in date order', () => {
    expect(groupRows([r('a', '2026-11-06'), r('b', '2026-11-03'), r('c', '2026-11-06')], by, 'day')).toHaveLength(3)
  })
})
