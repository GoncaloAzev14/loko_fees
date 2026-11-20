import { afterEach, describe, expect, it, vi } from 'vitest'
import { newUuid } from './uuid'

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

afterEach(() => vi.unstubAllGlobals())

describe('newUuid', () => {
  it('uses the browser\'s own generator when it has one, so current phones are unchanged', () => {
    const randomUUID = vi.fn(() => '11111111-2222-4333-8444-555555555555')
    vi.stubGlobal('crypto', { randomUUID, getRandomValues: vi.fn() })
    expect(newUuid()).toBe('11111111-2222-4333-8444-555555555555')
    expect(randomUUID).toHaveBeenCalledTimes(1)
  })

  it('works on an older iPhone, where randomUUID does not exist but random bytes do', () => {
    vi.stubGlobal('crypto', { getRandomValues: (a: Uint8Array) => a.forEach((_, i) => (a[i] = (i * 37 + 11) & 255)) })
    const id = newUuid()
    expect(id).toMatch(V4)
    expect(newUuid()).toBe(id) // same bytes in, same id out: it really comes from them
  })

  it('still works with no crypto at all', () => {
    vi.stubGlobal('crypto', undefined)
    expect(newUuid()).toMatch(V4)
  })

  it('always has the shape of a version 4 id, on every path', () => {
    for (const crypto of [undefined, {}, { getRandomValues: (a: Uint8Array) => a.fill(255) }, { getRandomValues: (a: Uint8Array) => a.fill(0) }]) {
      vi.stubGlobal('crypto', crypto)
      expect(newUuid()).toMatch(V4)
    }
  })

  it('does not repeat', () => {
    vi.stubGlobal('crypto', undefined)
    const ids = new Set(Array.from({ length: 5000 }, () => newUuid()))
    expect(ids.size).toBe(5000)
  })

  it('is what the real browser or Node provides when nothing is stubbed', () => {
    expect(newUuid()).toMatch(V4)
  })
})
