import { beforeEach, describe, expect, it, vi } from 'vitest'

const answers = vi.hoisted(() => ({ queue: [] as { data: unknown; error: { code?: string; message: string } | null }[], selects: [] as string[] }))

vi.mock('./supabase', () => ({
  supabase: {
    from: () => ({
      select: (columns: string) => {
        answers.selects.push(columns)
        return { single: async () => answers.queue.shift() }
      },
    }),
  },
}))

import { getSettings } from './api'

beforeEach(() => {
  answers.queue = []
  answers.selects = []
})

describe('getSettings', () => {
  it('returns the settings including the season', async () => {
    answers.queue.push({ data: { late_fine_amount: 5, due_day: 7, season: '2027/28' }, error: null })
    expect(await getSettings()).toEqual({ late_fine_amount: 5, due_day: 7, season: '2027/28' })
    expect(answers.selects).toHaveLength(1)
  })

  it('falls back to the default season when the database has no season column yet', async () => {
    answers.queue.push({ data: null, error: { code: '42703', message: 'column settings.season does not exist' } })
    answers.queue.push({ data: { late_fine_amount: 6, due_day: 10 }, error: null })
    expect(await getSettings()).toEqual({ late_fine_amount: 6, due_day: 10, season: '2026/27' })
    expect(answers.selects[1]).toBe('late_fine_amount, due_day')
  })

  it('still fails on any other error', async () => {
    answers.queue.push({ data: null, error: { code: '42501', message: 'permission denied' } })
    await expect(getSettings()).rejects.toThrow('permission denied')
    expect(answers.selects).toHaveLength(1)
  })
})
