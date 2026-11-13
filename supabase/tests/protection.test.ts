import { describe, expect, it } from 'vitest'
import { as, newDb } from './db'

const ADMIN = '00000000-0000-0000-0000-00000000000a'

async function fixture() {
  const db = await newDb()
  await db.exec(`
    insert into auth.users values ('${ADMIN}', 'admin@x.pt');
    insert into admins values ('${ADMIN}');
    insert into players (name) values ('Ana');
    insert into fine_types (name, default_amount) values ('Derrota', 2);
  `)
  return db
}

describe('protected deletes', () => {
  it('lets an admin rename or deactivate a player and a fine type', async () => {
    const db = await fixture()
    await as(db, { uid: ADMIN }, async () => {
      await db.exec(`update players set name = 'Ana Silva', role = 'staff', active = false`)
      await db.exec(`update fine_types set name = 'Derrota em casa', default_amount = 3, active = false`)
    })
    expect((await db.query<{ active: boolean }>('select active from players')).rows[0].active).toBe(false)
  })

  it('stops an admin deleting a player, who would take their fines and payments with them', async () => {
    const db = await fixture()
    await as(db, { uid: ADMIN }, async () => {
      await expect(db.exec(`delete from players`)).rejects.toThrow(/permission denied/)
    })
    expect((await db.query('select 1 from players')).rows).toHaveLength(1)
  })

  it('stops an admin deleting a fine type', async () => {
    const db = await fixture()
    await as(db, { uid: ADMIN }, async () => {
      await expect(db.exec(`delete from fine_types`)).rejects.toThrow(/permission denied/)
    })
    expect((await db.query('select 1 from fine_types')).rows).toHaveLength(1)
  })

  it('still lets an admin delete a mistaken fine or payment', async () => {
    const db = await fixture()
    await db.exec(`insert into payments (player_id, amount) select id, 1 from players`)
    await as(db, { uid: ADMIN }, async () => {
      await db.exec(`delete from payments`)
    })
    expect((await db.query('select 1 from payments')).rows).toHaveLength(0)
  })
})

describe('season setting', () => {
  it('defaults to 2026/27', async () => {
    const { rows } = await (await newDb()).query<{ season: string }>('select season from settings')
    expect(rows[0].season).toBe('2026/27')
  })

  it('lets an admin change it, and refuses malformed values', async () => {
    const db = await fixture()
    await as(db, { uid: ADMIN }, async () => {
      await db.exec(`update settings set season = '2027/28'`)
      await expect(db.exec(`update settings set season = 'abc'`)).rejects.toThrow()
    })
    expect((await db.query<{ season: string }>('select season from settings')).rows[0].season).toBe('2027/28')
  })
})
