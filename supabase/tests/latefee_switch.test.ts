import { describe, expect, it } from 'vitest'
import { as, newDb } from './db'

// The automatic late fee can be switched off by an admin (settings.late_fee_enabled). Off only stops NEW late
// fees: the ones already charged stay, and the amount and the due day are kept.

const ADMIN = '00000000-0000-0000-0000-00000000000a'
const USER = '00000000-0000-0000-0000-00000000000b'

async function fixture() {
  const db = await newDb()
  await db.exec(`
    insert into auth.users values ('${ADMIN}', 'admin@x.pt'), ('${USER}', 'user@x.pt');
    insert into admins values ('${ADMIN}');
    insert into players (name) values ('Ana'), ('Bruno');
    insert into fine_types (name, default_amount) values ('Derrota', 2);
  `)
  return db
}
type Db = Awaited<ReturnType<typeof fixture>>

const fineOn = (player: string, on: string) =>
  `insert into fines (player_id, fine_type_id, amount, fined_on)
   select p.id, t.id, 2, '${on}' from players p, fine_types t where p.name = '${player}' and t.name = 'Derrota';`
const apply = async (db: Db, today: string) => (await db.query<{ n: number }>(`select apply_late_fees('${today}') as n`)).rows[0].n
const lateFeeCount = async (db: Db) => (await db.query<{ n: number }>(`select count(*)::int as n from fines where kind = 'late_fee'`)).rows[0].n

describe('switching the automatic late fee off', () => {
  it('is on by default', async () => {
    const db = await fixture()
    expect((await db.query<{ on: boolean }>('select late_fee_enabled as on from settings')).rows[0].on).toBe(true)
  })

  it('adds no new late fees while it is off, and adds them again when it is back on', async () => {
    const db = await fixture()
    await db.exec(fineOn('Ana', '2026-10-10') + fineOn('Bruno', '2026-10-10'))
    await as(db, { uid: ADMIN }, async () => { await db.query('update settings set late_fee_enabled = false') })
    expect(await apply(db, '2026-11-12')).toBe(0)
    expect(await lateFeeCount(db)).toBe(0)
    await as(db, { uid: ADMIN }, async () => { await db.query('update settings set late_fee_enabled = true') })
    expect(await apply(db, '2026-11-12')).toBe(2) // nothing was lost: the fines are still overdue
    expect(await lateFeeCount(db)).toBe(2)
  })

  it('leaves the late fees that were already charged exactly as they are', async () => {
    const db = await fixture()
    await db.exec(fineOn('Ana', '2026-10-10'))
    expect(await apply(db, '2026-11-12')).toBe(1)
    await as(db, { uid: ADMIN }, async () => { await db.query('update settings set late_fee_enabled = false') })
    expect(await apply(db, '2026-12-12')).toBe(0)
    expect(await lateFeeCount(db)).toBe(1)
    expect((await db.query<{ amount: string }>(`select amount from fines where kind = 'late_fee'`)).rows[0].amount).toBe('5.00')
  })

  it('keeps the amount and the due day, so turning it back on is a single tap', async () => {
    const db = await fixture()
    await db.exec(`update settings set late_fine_amount = 8, due_day = 12`)
    await as(db, { uid: ADMIN }, async () => { await db.query('update settings set late_fee_enabled = false') })
    const s = (await db.query<{ late_fine_amount: string; due_day: number }>('select late_fine_amount, due_day from settings')).rows[0]
    expect([s.late_fine_amount, s.due_day]).toEqual(['8.00', 12])
  })

  it('can be read by a visitor (the Regulamento page needs it) but only an admin can change it', async () => {
    const db = await fixture()
    await as(db, 'anon', async () => {
      expect((await db.query('select late_fee_enabled from settings')).rows).toHaveLength(1)
    })
    await as(db, { uid: USER }, async () => {
      await db.query('update settings set late_fee_enabled = false')
    })
    expect((await db.query<{ on: boolean }>('select late_fee_enabled as on from settings')).rows[0].on).toBe(true) // nothing changed
  })
})
