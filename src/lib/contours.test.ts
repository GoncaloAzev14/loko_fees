import { describe, expect, it } from 'vitest'
import { DEFAULT_BLOBS, contourPaths } from './contours'

describe('contourPaths', () => {
  it('draws one closed path per ring', () => {
    const paths = contourPaths(390, 340)
    expect(paths).toHaveLength(DEFAULT_BLOBS.reduce((n, b) => n + b.rings, 0))
    for (const d of paths) {
      expect(d.startsWith('M')).toBe(true)
      expect(d.endsWith('Z')).toBe(true)
      expect(d).not.toMatch(/NaN|Infinity/)
    }
  })

  it('is deterministic, so the background never changes between renders', () => {
    expect(contourPaths(390, 340)).toEqual(contourPaths(390, 340))
  })

  it('makes rings that grow outwards from the same centre', () => {
    const [inner, , outer] = contourPaths(400, 400, [{ x: 0.5, y: 0.5, radius: 0.4, rings: 3, phase: 0 }])
    const firstX = (d: string) => Number(/^M(-?[\d.]+)/.exec(d)![1])
    expect(firstX(outer)).toBeGreaterThan(firstX(inner))
  })
})
