import { describe, expect, it } from 'vitest'
import { as, newDb } from './db'

// A payment can say how it was made: MB WAY or cash (dinheiro), and nothing else. Payments recorded before
// the column existed have none.

const ADMIN = '00000000-0000-0000-0000-00000000000a'

async function fixture() {
  const db = await newDb()
  await db.exec(`
    insert into auth.users values ('${ADMIN}', 'admin@x.pt');
    insert into admins values ('${ADMIN}');
    insert into players (name) values ('Ana');
  `)
  return db
}
type Db = Awaited<ReturnType<typeof fixture>>

const pay = (db: Db, method: string | null, id = '10000000-0000-0000-0000-000000000001') =>
  db.query(`insert into payments (id, player_id, amount, paid_on, method) select '${id}', id, 5, '2026-11-10', ${method === null ? 'null' : `'${method}'`} from players`)
const methodOf = async (db: Db) => (await db.query<{ method: string | null }>('select method from payments')).rows[0].method

describe('payment method', () => {
  it('accepts MB WAY and cash', async () => {
    const db = await fixture()
    await as(db, { uid: ADMIN }, async () => {
      await pay(db, 'mbway', '10000000-0000-0000-0000-000000000001')
      await pay(db, 'dinheiro', '10000000-0000-0000-0000-000000000002')
    })
    expect((await db.query<{ method: string }>('select method from payments order by id')).rows.map((r) => r.method)).toEqual(['mbway', 'dinheiro'])
  })

  it('refuses any other method', async () => {
    const db = await fixture()
    await as(db, { uid: ADMIN }, async () => {
      await expect(pay(db, 'cartao')).rejects.toThrow(/check constraint/)
      await expect(pay(db, 'MBWAY')).rejects.toThrow(/check constraint/)
      await expect(pay(db, '')).rejects.toThrow(/check constraint/)
    })
    expect((await db.query('select 1 from payments')).rows).toHaveLength(0)
  })

  it('allows an empty method, for the payments recorded before it existed and for entries saved on a phone before this was installed', async () => {
    const db = await fixture()
    await as(db, { uid: ADMIN }, async () => { await pay(db, null) })
    expect(await methodOf(db)).toBeNull()
  })

  it('does not change what a payment settles: the method has no effect on the debt', async () => {
    const db = await fixture()
    await db.exec(`insert into fine_types (name, default_amount) values ('Derrota', 5);
                   insert into fines (player_id, fine_type_id, amount, fined_on) select p.id, t.id, 5, '2026-11-01' from players p, fine_types t;`)
    await pay(db, 'mbway')
    const b = (await db.query<{ outstanding: string }>('select outstanding::float::text as outstanding from player_balance')).rows[0]
    expect(b.outstanding).toBe('0')
  })

  it('is kept when a deleted payment is put back from the history', async () => {
    const db = await fixture()
    await pay(db, 'mbway')
    await as(db, { uid: ADMIN }, async () => { await db.query('delete from payments') })
    const change = (await db.query<{ id: number }>(`select id from change_log where action = 'delete' and table_name = 'payments'`)).rows[0].id
    await as(db, { uid: ADMIN }, async () => { await db.query(`select restore_change(${change})`) })
    expect(await methodOf(db)).toBe('mbway')
  })
})
