import { describe, expect, it } from 'vitest'
import { describeEntry } from './entries'
import type { Entry } from './outbox'

const base = { id: 'e1', uid: 'u', at: 0 }
const player = (id: string) => ({ p1: 'Ana' })[id as 'p1']
const type = (id: string) => ({ t1: 'Derrota' })[id as 't1']
const plain = (s: string) => s.replace(/ /g, ' ')

describe('describeEntry', () => {
  it('describes a fine waiting to be added', () => {
    const e = { ...base, op: 'insert', table: 'fines', row: { id: 'x', player_id: 'p1', fine_type_id: 't1', amount: 2 } } as Entry
    expect(plain(describeEntry(e, player, type))).toBe('Derrota · Ana · 2,00 €')
  })

  it('describes payments, income and expenses', () => {
    expect(plain(describeEntry({ ...base, op: 'insert', table: 'payments', row: { id: 'x', player_id: 'p1', amount: 5 } } as Entry, player, type))).toBe('Pagamento · Ana · 5,00 €')
    expect(plain(describeEntry({ ...base, op: 'insert', table: 'incomes', row: { id: 'x', description: 'Prémio', amount: 40 } } as Entry, player, type))).toBe('Prémio · 40,00 €')
    expect(plain(describeEntry({ ...base, op: 'insert', table: 'expenses', row: { id: 'x', description: 'Jantar', amount: 12 } } as Entry, player, type))).toBe('Jantar · 12,00 €')
  })

  it('says how a payment waiting to be sent was made', () => {
    const e = (method: string) => ({ ...base, op: 'insert', table: 'payments', row: { id: 'x', player_id: 'p1', amount: 5, method } }) as Entry
    expect(plain(describeEntry(e('mbway'), player, type))).toBe('Pagamento MB WAY · Ana · 5,00 €')
    expect(plain(describeEntry(e('dinheiro'), player, type))).toBe('Pagamento Dinheiro · Ana · 5,00 €')
    expect(plain(describeEntry(e('cartao'), player, type))).toBe('Pagamento · Ana · 5,00 €') // never shows a value that is not one of the two
  })

  it('describes deletes and cancels', () => {
    expect(describeEntry({ ...base, op: 'delete', table: 'payments', rowId: 'x' } as Entry, player, type)).toBe('Apagar pagamento')
    expect(describeEntry({ ...base, op: 'cancel', rowId: 'x', cancelled: true } as Entry, player, type)).toBe('Anular multa')
    expect(describeEntry({ ...base, op: 'cancel', rowId: 'x', cancelled: false } as Entry, player, type)).toBe('Repor multa')
  })

  it('still gives a line when a player is no longer known', () => {
    const e = { ...base, op: 'insert', table: 'payments', row: { id: 'x', player_id: 'gone', amount: 1 } } as Entry
    expect(plain(describeEntry(e, player, type))).toBe('Pagamento · 1,00 €')
  })
})
