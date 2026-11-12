import { describe, expect, it } from 'vitest'
import { as, newDb } from './db'

const ADMIN = '00000000-0000-0000-0000-00000000000a'
const OTHER_ADMIN = '00000000-0000-0000-0000-00000000000c'
const USER = '00000000-0000-0000-0000-00000000000b'

async function fixture() {
  const db = await newDb()
  await db.exec(`
    insert into auth.users values ('${ADMIN}', 'Ana@Club.pt'), ('${OTHER_ADMIN}', 'bruno@club.pt'), ('${USER}', 'carla@club.pt');
    insert into admins values ('${ADMIN}'), ('${OTHER_ADMIN}');
  `)
  return db
}

describe('admin management', () => {
  it('lets admins list admins with their emails', async () => {
    const db = await fixture()
    const rows = await as(db, { uid: ADMIN }, async () => (await db.query<{ email: string }>('select email from list_admins()')).rows)
    expect(rows.map((r) => r.email)).toEqual(['Ana@Club.pt', 'bruno@club.pt'])
  })

  it('shows nothing to signed-in non-admins and is closed to visitors', async () => {
    const db = await fixture()
    await as(db, { uid: USER }, async () => {
      expect((await db.query('select * from list_admins()')).rows).toHaveLength(0)
    })
    await as(db, 'anon', async () => {
      await expect(db.query('select * from list_admins()')).rejects.toThrow()
    })
  })

  it('lets an admin remove another admin, but not themselves', async () => {
    const db = await fixture()
    await as(db, { uid: ADMIN }, async () => {
      await expect(db.query(`select remove_admin('${ADMIN}')`)).rejects.toThrow(/própria conta/)
      await db.query(`select remove_admin('${OTHER_ADMIN}')`)
    })
    expect((await db.query('select 1 from admins')).rows).toHaveLength(1)
  })

  it('refuses removal by non-admins', async () => {
    const db = await fixture()
    await as(db, { uid: USER }, async () => {
      await expect(db.query(`select remove_admin('${ADMIN}')`)).rejects.toThrow(/administradores/)
    })
    expect((await db.query('select 1 from admins')).rows).toHaveLength(2)
  })

  it('add_admin_by_email promotes an existing account (case-insensitive), is idempotent, and reports unknown emails', async () => {
    const db = await fixture()
    const add = async (email: string) => (await db.query<{ ok: boolean }>(`select add_admin_by_email('${email}') as ok`)).rows[0].ok
    expect(await add(' CARLA@club.pt ')).toBe(true)
    expect(await add('carla@club.pt')).toBe(true)
    expect(await add('nobody@club.pt')).toBe(false)
    expect((await db.query('select 1 from admins')).rows).toHaveLength(3)
  })

  it('keeps add_admin_by_email away from app users', async () => {
    const db = await fixture()
    for (const who of ['anon', { uid: ADMIN }] as const) {
      await as(db, who, async () => {
        await expect(db.query(`select add_admin_by_email('carla@club.pt')`)).rejects.toThrow()
      })
    }
  })
})
