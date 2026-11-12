import { describe, expect, it } from 'vitest'
import { formatDate, monthRange, parseAmount, parseDate, toISO } from './format'

describe('format', () => {
  it('parses ISO dates as local dates', () => {
    const d = parseDate('2026-11-01')
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 10, 1])
    expect(toISO(d)).toBe('2026-11-01')
  })

  it('formats dates in Portuguese', () => {
    expect(formatDate('2026-11-06')).toBe('06/11/2026')
  })

  it('computes month ranges, including year boundaries and leap years', () => {
    const now = new Date(2026, 0, 15)
    expect(monthRange(0, now)).toEqual({ from: '2026-01-01', to: '2026-01-31' })
    expect(monthRange(-1, now)).toEqual({ from: '2025-12-01', to: '2025-12-31' })
    expect(monthRange(1, new Date(2028, 0, 31))).toEqual({ from: '2028-02-01', to: '2028-02-29' })
  })

  it('parses amounts with comma or dot and rejects junk', () => {
    expect(parseAmount('2,5')).toBe(2.5)
    expect(parseAmount(' 10 ')).toBe(10)
    expect(parseAmount('')).toBeNaN()
    expect(parseAmount('abc')).toBeNaN()
  })
})
