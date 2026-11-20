import { describe, expect, it } from 'vitest'
import { finesInForce, LATE_FEE_NAME, sortedTypes } from './regulamento'
import type { FineType } from './types'

const type = (id: string, name: string, default_amount: number, active = true): FineType => ({ id, name, default_amount, active })

describe('finesInForce', () => {
  it('lists the active fine types alphabetically and leaves out the inactive ones', () => {
    const rows = finesInForce([type('1', 'Treino em falta', 3), type('2', 'Atraso', 1), type('3', 'Antiga', 9, false), type('4', 'Álcool', 2)])
    expect(rows.map((r) => r.description)).toEqual(['Álcool', 'Atraso', 'Treino em falta'])
    expect(rows.map((r) => r.amount)).toEqual([2, 1, 3])
    expect(rows.every((r) => r.note === undefined)).toBe(true)
  })

  it('adds the late fee last, even when it is zero, and explains that unpaid fines are marked as vencidas', () => {
    const rows = finesInForce([type('1', 'Atraso', 1)], { amount: 5, dueDay: 7 })
    const late = rows.at(-1)!
    expect(late).toMatchObject({ key: 'late-fee', description: LATE_FEE_NAME, amount: 5 })
    expect(late.note).toContain('dia 7 do mês seguinte')
    expect(late.note).toContain('vencidas')
    expect(finesInForce([], { amount: 0, dueDay: 7 })).toHaveLength(1)
  })

  it('follows the due day from the settings', () => {
    expect(finesInForce([], { amount: 5, dueDay: 12 })[0].note).toContain('dia 12 do mês seguinte')
  })

  it('has no late fee card while the settings are not loaded', () => {
    expect(finesInForce([type('1', 'Atraso', 1)])).toHaveLength(1)
    expect(finesInForce([type('1', 'Atraso', 1)], null)).toHaveLength(1)
  })
})

describe('sortedTypes', () => {
  it('keeps the inactive types, which an admin needs to switch them back on, in alphabetical order', () => {
    const rows = sortedTypes([type('1', 'Treino', 3), type('2', 'Antiga', 9, false), type('3', 'Atraso', 1)])
    expect(rows.map((t) => t.name)).toEqual(['Antiga', 'Atraso', 'Treino'])
  })

  it('does not reorder the list it was given', () => {
    const given = [type('1', 'B', 1), type('2', 'A', 1)]
    sortedTypes(given)
    expect(given.map((t) => t.name)).toEqual(['B', 'A'])
  })
})
