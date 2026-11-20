import { describe, expect, it } from 'vitest'
import { describeChange as describe_, whoLabel } from './changes'
import type { Change } from './types'

// money() puts a non-breaking space before the euro sign; compare with a plain one
const describeChange = (...a: Parameters<typeof describe_>) => {
  const r = describe_(...a)
  return { title: r.title, detail: r.detail.replace(/\u00a0/g, ' ') }
}
const players = new Map([['p1', 'Ana'], ['p2', 'Bruno']])
const types = new Map([['t1', 'Derrota']])
const change = (o: Partial<Change>): Change => ({
  id: 1, at: '2026-11-20T01:24:06Z', who_email: 'bia@x.pt', action: 'insert', table_name: 'fines', row_id: 'r1', old_row: null, new_row: null, restorable: false, ...o,
})

describe('describeChange', () => {
  it('says what was done to a fine, with the player, the reason and the amount', () => {
    const c = change({ action: 'delete', old_row: { player_id: 'p1', fine_type_id: 't1', amount: 5, kind: 'fine' } })
    expect(describeChange(c, players, types)).toEqual({ title: 'Apagou multa', detail: 'Ana · Derrota · 5,00 €' })
  })

  it('calls a late fee a late fee, and does not invent a reason for it', () => {
    const c = change({ action: 'delete', old_row: { player_id: 'p2', fine_type_id: null, amount: 5, kind: 'late_fee' } })
    expect(describeChange(c, players, types)).toEqual({ title: 'Apagou multa de atraso', detail: 'Bruno · 5,00 €' })
  })

  it('tells cancelling and restoring a fine from other changes', () => {
    const base = { player_id: 'p1', fine_type_id: 't1', amount: 2, kind: 'fine' }
    expect(describeChange(change({ action: 'update', old_row: { ...base, cancelled: false }, new_row: { ...base, cancelled: true } }), players, types).title).toBe('Anulou multa')
    expect(describeChange(change({ action: 'update', old_row: { ...base, cancelled: true }, new_row: { ...base, cancelled: false } }), players, types).title).toBe('Repôs multa')
    expect(describeChange(change({ action: 'update', old_row: { ...base, amount: 1, cancelled: false }, new_row: { ...base, cancelled: false } }), players, types).title).toBe('Alterou multa')
  })

  it('shows how a payment was made in the history', () => {
    expect(describeChange(change({ table_name: 'payments', new_row: { player_id: 'p1', amount: 40, method: 'mbway' } }), players, types).detail).toBe('Ana · 40,00 € · MB WAY')
    expect(describeChange(change({ table_name: 'payments', new_row: { player_id: 'p1', amount: 40, method: null } }), players, types).detail).toBe('Ana · 40,00 €')
  })

  it('describes payments, income, expenses, people and settings', () => {
    expect(describeChange(change({ table_name: 'payments', new_row: { player_id: 'p1', amount: 40 } }), players, types)).toEqual({ title: 'Adicionou pagamento', detail: 'Ana · 40,00 €' })
    expect(describeChange(change({ table_name: 'incomes', new_row: { description: 'Prémio', amount: 100, player_id: null } }), players, types)).toEqual({ title: 'Adicionou receita', detail: 'Prémio · 100,00 €' })
    expect(describeChange(change({ table_name: 'expenses', action: 'delete', old_row: { description: 'Jantar', amount: 12 } }), players, types)).toEqual({ title: 'Apagou despesa', detail: 'Jantar · 12,00 €' })
    expect(describeChange(change({ table_name: 'players', new_row: { name: 'Carla' } }), players, types)).toEqual({ title: 'Adicionou jogador', detail: 'Carla' })
    expect(describeChange(change({ table_name: 'settings', action: 'update', old_row: { late_fine_amount: 5, season: '2026/27' }, new_row: { late_fine_amount: 6, season: '2026/27' } }), players, types))
      .toEqual({ title: 'Alterou definições', detail: 'late_fine_amount: 5 → 6' })
  })

  it('still gives a plain line for a player that no longer exists or a table it does not know', () => {
    expect(describeChange(change({ action: 'delete', old_row: { player_id: 'gone', fine_type_id: 't1', amount: 1, kind: 'fine' } }), players, types).detail).toBe('Derrota · 1,00 €')
    expect(describeChange(change({ table_name: 'mystery', new_row: {} }), players, types)).toEqual({ title: 'Adicionou mystery', detail: '' })
  })
})

describe('whoLabel', () => {
  it('shows the part of the email before the @, or Sistema for the app itself', () => {
    expect(whoLabel('daniel@loko.test')).toBe('daniel')
    expect(whoLabel(null)).toBe('Sistema')
  })
})
