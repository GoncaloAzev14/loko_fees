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

import { matchesQuery, normalize } from './paymentsView'

describe('normalize', () => {
  it('drops accents and case', () => {
    expect(normalize('Aurélio  Março')).toBe('aurelio  marco')
  })
})

describe('matchesQuery', () => {
  const pay = { amount: 5, paid_on: '2026-11-06', note: 'Dinheiro na mão' }
  const hit = (q: string) => matchesQuery(pay, 'Aurélio Campos', 'Novembro de 2026', '06/11/2026', q)

  it('matches everything when nothing is typed', () => {
    expect(hit('')).toBe(true)
    expect(hit('   ')).toBe(true)
  })

  it('finds a payment by the player, ignoring accents and case', () => {
    expect(hit('aurelio')).toBe(true)
    expect(hit('CAMPOS')).toBe(true)
    expect(hit('bruno')).toBe(false)
  })

  it('finds it by the note, the amount in any of its forms, the date and the month', () => {
    expect(hit('dinheiro')).toBe(true)
    expect(hit('5,00')).toBe(true)
    expect(hit('5.00')).toBe(true)
    expect(hit('06/11')).toBe(true)
    expect(hit('2026-11')).toBe(true)
    expect(hit('novembro')).toBe(true)
    expect(hit('outubro')).toBe(false)
    expect(hit('7,00')).toBe(false)
  })

  it('needs every word typed, in any order', () => {
    expect(hit('campos 5,00')).toBe(true)
    expect(hit('5,00 aurelio')).toBe(true)
    expect(hit('campos bruno')).toBe(false)
  })

  it('copes with a payment that has no note', () => {
    expect(matchesQuery({ amount: 2.5, paid_on: '2026-10-01', note: null }, 'Ana', 'Outubro de 2026', '01/10/2026', '2,50')).toBe(true)
  })
})

describe('searching payments by how they were made', () => {
  const pay = (method: string | null) => ({ amount: 5, paid_on: '2026-11-06', note: null, method })
  it('finds MB WAY and cash payments by the words on screen, with or without the space', () => {
    expect(matchesQuery(pay('mbway'), 'Ana', 'Novembro de 2026', '06/11/2026', 'mb way')).toBe(true)
    expect(matchesQuery(pay('mbway'), 'Ana', 'Novembro de 2026', '06/11/2026', 'MB')).toBe(true)
    expect(matchesQuery(pay('dinheiro'), 'Ana', 'Novembro de 2026', '06/11/2026', 'dinheiro')).toBe(true)
    expect(matchesQuery(pay('dinheiro'), 'Ana', 'Novembro de 2026', '06/11/2026', 'mb way')).toBe(false)
  })
  it('does not match an older payment that has no method', () => {
    expect(matchesQuery(pay(null), 'Ana', 'Novembro de 2026', '06/11/2026', 'dinheiro')).toBe(false)
  })
})
