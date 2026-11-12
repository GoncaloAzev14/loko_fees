import { describe, expect, it } from 'vitest'
import { debtSeries } from './debtSeries'

const fine = (fined_on: string, amount: number, cancelled = false) => ({ fined_on, amount, cancelled })
const pay = (paid_on: string, amount: number) => ({ paid_on, amount })

describe('debtSeries', () => {
  it('adds fines and subtracts payments in date order', () => {
    expect(debtSeries([fine('2026-10-01', 2), fine('2026-10-10', 3)], [pay('2026-10-05', 1)])).toEqual([
      { date: '2026-10-01', owed: 2 },
      { date: '2026-10-05', owed: 1 },
      { date: '2026-10-10', owed: 4 },
    ])
  })

  it('merges events on the same day', () => {
    expect(debtSeries([fine('2026-10-01', 2), fine('2026-10-01', 2)], [])).toEqual([{ date: '2026-10-01', owed: 4 }])
  })

  it('ignores cancelled fines', () => {
    expect(debtSeries([fine('2026-10-01', 2, true), fine('2026-10-02', 1)], [])).toEqual([{ date: '2026-10-02', owed: 1 }])
  })

  it('never goes below zero when a player is in credit', () => {
    expect(debtSeries([fine('2026-10-01', 2)], [pay('2026-10-02', 5)])).toEqual([
      { date: '2026-10-01', owed: 2 },
      { date: '2026-10-02', owed: 0 },
    ])
  })

  it('does not drift on cents', () => {
    const series = debtSeries([fine('2026-10-01', 0.1), fine('2026-10-02', 0.2)], [])
    expect(series[1].owed).toBe(0.3)
  })

  it('is empty without events', () => {
    expect(debtSeries([], [])).toEqual([])
  })
})
