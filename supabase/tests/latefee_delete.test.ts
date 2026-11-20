import { describe, expect, it } from 'vitest'
import { as, newDb } from './db'

// A late fee that an admin deletes must stay deleted. The rule that adds late fees runs every time an
// admin opens the app, and used to put a deleted one straight back.

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
const lateFees = async (db: Db) =>
  (await db.query<{ name: string; month: string }>(
    `select p.name, to_char(f.late_for_month, 'YYYY-MM') as month from fines f join players p on p.id = f.player_id
     where f.kind = 'late_fee' order by p.name, f.late_for_month`)).rows
const apply = async (db: Db, today: string) => (await db.query<{ n: number }>(`select apply_late_fees('${today}') as n`)).rows[0].n

describe('deleting a late fee', () => {
  it('keeps it deleted, however many times the rule runs again', async () => {
    const db = await fixture()
    await db.exec(fineOn('Ana', '2026-10-10') + fineOn('Bruno', '2026-10-10'))
    expect(await apply(db, '2026-11-12')).toBe(2)
    await as(db, { uid: ADMIN }, async () => {
      await db.query(`delete from fines where kind = 'late_fee' and player_id = (select id from players where name = 'Ana')`)
    })
    expect(await apply(db, '2026-11-12')).toBe(0) // the app opens again: nothing comes back
    expect(await apply(db, '2026-11-13')).toBe(0)
    expect(await lateFees(db)).toEqual([{ name: 'Bruno', month: '2026-10' }])
  })

  it('only waives that player and that month', async () => {
    const db = await fixture()
    await db.exec(fineOn('Ana', '2026-10-10') + fineOn('Bruno', '2026-10-10'))
    await apply(db, '2026-11-12')
    await db.exec(`delete from fines where kind = 'late_fee' and player_id = (select id from players where name = 'Ana')`)
    await db.exec(fineOn('Ana', '2026-11-10')) // a later month, still unpaid
    expect(await apply(db, '2026-12-12')).toBe(1) // Ana's November is new; her October stays waived; Bruno's October already has one
    expect((await lateFees(db)).map((r) => `${r.name} ${r.month}`)).toEqual(['Ana 2026-11', 'Bruno 2026-10'])
  })

  it('still adds the late fee for someone whose fee was never deleted', async () => {
    const db = await fixture()
    await db.exec(fineOn('Ana', '2026-10-10'))
    await db.exec(`insert into late_fee_waivers (player_id, month) select id, '2026-09-01' from players where name = 'Bruno'`)
    expect(await apply(db, '2026-11-12')).toBe(1)
  })

  it('is not triggered by deleting an ordinary fine', async () => {
    const db = await fixture()
    await db.exec(fineOn('Ana', '2026-10-10'))
    await db.exec(`delete from fines where kind = 'fine'`)
    expect((await db.query('select 1 from late_fee_waivers')).rows).toHaveLength(0)
  })

  it('cancelling instead of deleting keeps working as before', async () => {
    const db = await fixture()
    await db.exec(fineOn('Ana', '2026-10-10'))
    await apply(db, '2026-11-12')
    await db.exec(`update fines set cancelled = true where kind = 'late_fee'`)
    expect(await apply(db, '2026-11-12')).toBe(0)
    expect(await lateFees(db)).toHaveLength(1)
  })

  it('is forgotten when the season is closed, together with the fines it belonged to', async () => {
    const db = await fixture()
    await db.exec(fineOn('Ana', '2026-10-10'))
    await apply(db, '2026-11-12')
    await as(db, { uid: ADMIN }, async () => {
      await db.query(`delete from fines where kind = 'late_fee'`)
      expect((await db.query('select 1 from late_fee_waivers')).rows).toHaveLength(1)
      await db.query(`select close_season('2027/28')`)
    })
    expect((await db.query('select 1 from late_fee_waivers')).rows).toHaveLength(0)
    expect((await db.query('select 1 from fines')).rows).toHaveLength(0)
  })

  it('closing a season with late fees in it leaves no waivers behind either', async () => {
    const db = await fixture()
    await db.exec(fineOn('Ana', '2026-10-10'))
    await apply(db, '2026-11-12') // a late fee exists and will be deleted by the close itself
    await as(db, { uid: ADMIN }, async () => {
      await db.query(`select close_season('2027/28')`)
    })
    expect((await db.query('select 1 from late_fee_waivers')).rows).toHaveLength(0)
  })

  it('is visible to admins only', async () => {
    const db = await fixture()
    await db.exec(fineOn('Ana', '2026-10-10'))
    await apply(db, '2026-11-12')
    await db.exec(`delete from fines where kind = 'late_fee'`)
    await as(db, { uid: ADMIN }, async () => {
      expect((await db.query('select 1 from late_fee_waivers')).rows).toHaveLength(1)
    })
    await as(db, { uid: USER }, async () => {
      expect((await db.query('select 1 from late_fee_waivers')).rows).toHaveLength(0)
    })
    await as(db, 'anon', async () => {
      await expect(db.query('select 1 from late_fee_waivers')).rejects.toThrow()
    })
  })
})
