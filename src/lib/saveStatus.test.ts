import { describe, expect, it } from 'vitest'
import { saveStatus } from './saveStatus'

const GOOD = { tone: 'good', text: 'Guardado no servidor ✓' }

describe('saveStatus', () => {
  it('says nothing before anything was saved', () => {
    expect(saveStatus(null, [])).toBeNull()
    expect(saveStatus(null, [{ id: 'a', failed: 'no' }])).toBeNull()
  })

  it('says it reached the server when saving went straight there, whatever else is in the queue', () => {
    expect(saveStatus({ queued: false, ids: [] }, [])).toEqual(GOOD)
    expect(saveStatus({ queued: false, ids: [] }, [{ id: 'old', failed: 'refused long ago' }, { id: 'other' }])).toEqual(GOOD)
  })

  it('warns that it is only on the phone while its entries wait to be sent', () => {
    expect(saveStatus({ queued: true, ids: ['a'] }, [{ id: 'a' }])).toEqual({ tone: 'warn', text: 'Guardado só no telemóvel: falta enviar' })
    expect(saveStatus({ queued: true, ids: ['a', 'b'] }, [{ id: 'a' }, { id: 'b' }, { id: 'c', failed: 'x' }])).toMatchObject({ tone: 'warn' })
  })

  it('says it was refused when one of its own entries was', () => {
    expect(saveStatus({ queued: true, ids: ['a', 'b'] }, [{ id: 'a' }, { id: 'b', failed: 'violates foreign key' }]))
      .toEqual({ tone: 'bad', text: 'O servidor não aceitou: veja o Histórico' })
  })

  it('is not fooled by another entry that was refused, which says nothing about this save', () => {
    expect(saveStatus({ queued: true, ids: ['a'] }, [{ id: 'old', failed: 'refused long ago' }])).toEqual(GOOD) // a was sent; the old one is someone else's story
    expect(saveStatus({ queued: true, ids: ['a'] }, [{ id: 'a' }, { id: 'old', failed: 'x' }])).toMatchObject({ tone: 'warn' })
  })

  it('turns the warning into a confirmation once its entries have been sent', () => {
    expect(saveStatus({ queued: true, ids: ['a'] }, [])).toEqual(GOOD)
  })

  it('says a change that never left the phone was simply undone, and is not "saved on the server"', () => {
    expect(saveStatus({ queued: true, ids: [] }, [])).toEqual({ tone: 'good', text: 'Feito: a alteração ainda não tinha sido enviada' })
  })
})
