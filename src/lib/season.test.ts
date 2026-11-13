import { describe, expect, it } from 'vitest'
import { isSeason, nextSeason } from './season'

describe('season', () => {
  it('accepts a season whose second year follows the first', () => {
    expect(isSeason('2026/27')).toBe(true)
    expect(isSeason(' 2099/00 ')).toBe(true)
  })

  it('rejects anything else', () => {
    for (const bad of ['2026/28', '2026-27', '26/27', '2026/2027', '', 'abc']) expect(isSeason(bad)).toBe(false)
  })

  it('computes the next season, across the century', () => {
    expect(nextSeason('2026/27')).toBe('2027/28')
    expect(nextSeason('2099/00')).toBe('2100/01')
  })
})
