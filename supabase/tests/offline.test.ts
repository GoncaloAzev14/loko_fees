import { describe, expect, it } from 'vitest'
import { as, newDb } from './db'

// Entries saved on a phone are sent when the connection returns, and may be sent more than once
// (an answer got lost on the way). Each carries its own id, and the app sends it with
// "insert ... on conflict (id) do nothing", which is what these tests exercise.

const ADMIN = '00000000-0000-0000-0000-00000000000a'
const USER = '00000000-0000-0000-0000-00000000000b'
const ID = (n: number) => `10000000-0000-0000-0000-${String(n).padStart(12, '0')}`

async function fixture() {
  const db = await newDb()
  await db.exec(`
    insert into auth.users values ('${ADMIN}', 'admin@x.pt'), ('${USER}', 'user@x.pt');
    insert into admins values ('${ADMIN}');
    insert into players (id, name) values ('${ID(900)}', 'Ana');
    insert into fine_types (id, name, default_amount) values ('${ID(901)}', 'Derrota', 2);
  `)
  return db
}

const inserts: Record<string, (id: string) => string> = {
  fines: (id) => `insert into fines (id, player_id, fine_type_id, amount, fined_on) values ('${id}', '${ID(900)}', '${ID(901)}', 2, '2026-11-10') on conflict (id) do nothing`,
  payments: (id) => `insert into payments (id, player_id, amount, paid_on) values ('${id}', '${ID(900)}', 5, '2026-11-10') on conflict (id) do nothing`,
  incomes: (id) => `insert into incomes (id, amount, received_on, description) values ('${id}', 40, '2026-11-10', 'Prémio') on conflict (id) do nothing`,
  expenses: (id) => `insert into expenses (id, amount, spent_on, description) values ('${id}', 12, '2026-11-10', 'Jantar') on conflict (id) do nothing`,
}

describe('sending a saved entry again', () => {
  for (const [table, insert] of Object.entries(inserts)) {
    it(`makes one ${table} row however many times it is sent`, async () => {
      const db = await fixture()
      await as(db, { uid: ADMIN }, async () => {
        await db.query(insert(ID(1)))
        await db.query(insert(ID(1)))
        await db.query(insert(ID(1)))
      })
      expect((await db.query(`select 1 from ${table}`)).rows).toHaveLength(1)
    })
  }

  it('keeps different entries apart', async () => {
    const db = await fixture()
    await as(db, { uid: ADMIN }, async () => {
      await db.query(inserts.payments(ID(1)))
      await db.query(inserts.payments(ID(2)))
    })
    expect((await db.query(`select 1 from payments`)).rows).toHaveLength(2)
  })

  it('does not change a row that is already there', async () => {
    const db = await fixture()
    await as(db, { uid: ADMIN }, async () => {
      await db.query(inserts.payments(ID(1)))
      await db.query(`update payments set amount = 9 where id = '${ID(1)}'`)
      await db.query(inserts.payments(ID(1))) // the same entry sent again must not undo the change
    })
    expect((await db.query<{ a: number }>(`select amount::float as a from payments`)).rows[0].a).toBe(9)
  })

  it('is still refused for people who are not admins, whatever the id', async () => {
    const db = await fixture()
    await as(db, { uid: USER }, async () => {
      for (const insert of Object.values(inserts)) await expect(db.query(insert(ID(1)))).rejects.toThrow()
    })
    await as(db, 'anon', async () => {
      for (const insert of Object.values(inserts)) await expect(db.query(insert(ID(1)))).rejects.toThrow()
    })
    for (const table of Object.keys(inserts)) expect((await db.query(`select 1 from ${table}`)).rows).toHaveLength(0)
  })

  it('a delete or a cancel sent twice is harmless', async () => {
    const db = await fixture()
    await as(db, { uid: ADMIN }, async () => {
      await db.query(inserts.fines(ID(1)))
      await db.query(`update fines set cancelled = true where id = '${ID(1)}'`)
      await db.query(`update fines set cancelled = true where id = '${ID(1)}'`)
      await db.query(`delete from fines where id = '${ID(1)}'`)
      await db.query(`delete from fines where id = '${ID(1)}'`)
    })
    expect((await db.query(`select 1 from fines`)).rows).toHaveLength(0)
  })
})
