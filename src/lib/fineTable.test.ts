import { describe, expect, it } from 'vitest'
import { finesInForce, LATE_FEE_NAME } from './fineTable'
import type { FineType } from './types'

const type = (id: string, name: string, default_amount: number, active = true): FineType => ({ id, name, default_amount, active })

describe('finesInForce', () => {
  it('lists the active fine types alphabetically and leaves out the inactive ones', () => {
    const rows = finesInForce([type('1', 'Treino em falta', 3), type('2', 'Atraso', 1), type('3', 'Antiga', 9, false), type('4', 'Álcool', 2)])
    expect(rows.map((r) => r.description)).toEqual(['Álcool', 'Atraso', 'Treino em falta'])
    expect(rows.map((r) => r.amount)).toEqual([2, 1, 3])
  })

  it('adds the late fee last when the settings are known, even when it is zero', () => {
    const rows = finesInForce([type('1', 'Atraso', 1)], 5)
    expect(rows.at(-1)).toEqual({ key: 'late-fee', description: LATE_FEE_NAME, amount: 5 })
    expect(finesInForce([], 0)).toHaveLength(1)
  })

  it('has no late fee card while the settings are not loaded', () => {
    expect(finesInForce([type('1', 'Atraso', 1)])).toHaveLength(1)
    expect(finesInForce([type('1', 'Atraso', 1)], null)).toHaveLength(1)
  })
})
