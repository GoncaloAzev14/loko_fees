import { describe, expect, it } from 'vitest'
import { addToast, LIFETIME, MAX_TOASTS, removeToast, type ToastItem } from './toasts'

const t = (id: number, tone: ToastItem['tone'] = 'good'): ToastItem => ({ id, text: `t${id}`, tone })

describe('toasts', () => {
  it('keeps them in the order they came', () => {
    expect(addToast([t(1)], t(2)).map((x) => x.id)).toEqual([1, 2])
  })

  it('pushes the oldest out so a burst of saves cannot cover the screen', () => {
    let list: ToastItem[] = []
    for (let i = 1; i <= 7; i++) list = addToast(list, t(i))
    expect(list).toHaveLength(MAX_TOASTS)
    expect(list.map((x) => x.id)).toEqual([5, 6, 7])
  })

  it('removes one by id and leaves the rest', () => {
    expect(removeToast([t(1), t(2), t(3)], 2).map((x) => x.id)).toEqual([1, 3])
    expect(removeToast([t(1)], 99)).toHaveLength(1)
  })

  it('leaves a warning or an error up longer than a plain confirmation, so it gets read', () => {
    expect(LIFETIME.warn).toBeGreaterThan(LIFETIME.good)
    expect(LIFETIME.bad).toBeGreaterThanOrEqual(LIFETIME.warn)
  })
})
