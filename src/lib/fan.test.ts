import { describe, expect, it } from 'vitest'
import { fanPositions } from './fan'

describe('fanPositions', () => {
  it('spreads items symmetrically over the arc, left to right', () => {
    const p = fanPositions(7)
    expect(p).toHaveLength(7)
    expect(p[3]).toEqual({ cx: 0, cy: 1 }) // the middle item sits straight above the button
    expect(p[0].cx).toBeLessThan(0)
    expect(p[6].cx).toBeGreaterThan(0)
    for (let i = 0; i < 3; i++) {
      expect(p[i].cx).toBeCloseTo(-p[6 - i].cx, 3)
      expect(p[i].cy).toBeCloseTo(p[6 - i].cy, 3)
    }
  })

  it('keeps every item above the tab bar', () => {
    for (const { cy } of fanPositions(7)) expect(cy).toBeGreaterThan(0.3)
  })

  it('handles a single item', () => {
    expect(fanPositions(1)).toEqual([{ cx: 0, cy: 1 }])
  })
})
