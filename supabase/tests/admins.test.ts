import { readFileSync } from 'node:fs'
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

  it('an invitation gives no rights until it is accepted', async () => {
    const db = await fixture()
    await db.query(`select add_admin_by_email('carla@club.pt')`)
    const isAdmin = (uid: string) => as(db, { uid }, async () => (await db.query<{ a: boolean }>('select is_admin() as a')).rows[0].a)
    expect(await isAdmin(USER)).toBe(false) // invited, not accepted
    expect(await isAdmin(ADMIN)).toBe(true) // added by hand: active straight away
    // ...and a pending invitee cannot do what admins do
    await as(db, { uid: USER }, async () => {
      await expect(db.query(`insert into fine_types (name, default_amount) values ('x', 1)`)).rejects.toThrow()
    })
  })

  it('lists pending invitations as pending, and accepted admins as active', async () => {
    const db = await fixture()
    await db.query(`select add_admin_by_email('carla@club.pt')`)
    const rows = await as(db, { uid: ADMIN }, async () => (await db.query<{ email: string; pending: boolean }>('select email, pending from list_admins()')).rows)
    expect(rows).toEqual([
      { email: 'Ana@Club.pt', pending: false },
      { email: 'bruno@club.pt', pending: false },
      { email: 'carla@club.pt', pending: true },
    ])
  })

  it('a pending person becomes an admin by accepting their own invitation', async () => {
    const db = await fixture()
    await db.query(`select add_admin_by_email('carla@club.pt')`)
    await as(db, { uid: USER }, async () => {
      await db.query('select accept_admin_invite()')
      expect((await db.query<{ a: boolean }>('select is_admin() as a')).rows[0].a).toBe(true)
    })
    const rows = await as(db, { uid: ADMIN }, async () => (await db.query<{ pending: boolean }>('select pending from list_admins()')).rows)
    expect(rows.some((r) => r.pending)).toBe(false)
  })

  it('accepting does nothing for someone who was never invited, and is closed to visitors', async () => {
    const db = await fixture()
    const stranger = '00000000-0000-0000-0000-0000000000f1'
    await db.exec(`insert into auth.users values ('${stranger}', 'dora@club.pt')`)
    await as(db, { uid: stranger }, async () => {
      await db.query('select accept_admin_invite()')
      expect((await db.query<{ a: boolean }>('select is_admin() as a')).rows[0].a).toBe(false)
    })
    expect((await db.query('select 1 from admins')).rows).toHaveLength(2)
    await as(db, 'anon', async () => {
      await expect(db.query('select accept_admin_invite()')).rejects.toThrow()
    })
  })

  it('my_invite_pending is true only for the signed-in person with a pending invitation', async () => {
    const db = await fixture()
    await db.query(`select add_admin_by_email('carla@club.pt')`)
    const stranger = '00000000-0000-0000-0000-0000000000f2'
    await db.exec(`insert into auth.users values ('${stranger}', 'dora@club.pt')`)
    const pending = (uid: string) => as(db, { uid }, async () => (await db.query<{ p: boolean }>('select my_invite_pending() as p')).rows[0].p)
    expect(await pending(USER)).toBe(true)
    expect(await pending(ADMIN)).toBe(false) // already an admin
    expect(await pending(stranger)).toBe(false) // never invited
    await as(db, 'anon', async () => {
      await expect(db.query('select my_invite_pending()')).rejects.toThrow()
    })
  })

  it('inviting again never turns an accepted admin back into a pending one', async () => {
    const db = await fixture()
    await db.query(`select add_admin_by_email('ana@club.pt')`)
    const rows = await as(db, { uid: ADMIN }, async () => (await db.query<{ pending: boolean }>('select pending from list_admins()')).rows)
    expect(rows.some((r) => r.pending)).toBe(false)
  })

  it('cancelling a pending invitation removes it', async () => {
    const db = await fixture()
    await db.query(`select add_admin_by_email('carla@club.pt')`)
    await as(db, { uid: ADMIN }, async () => {
      await db.query(`select remove_admin('${USER}')`)
    })
    expect((await db.query('select 1 from admins')).rows).toHaveLength(2)
  })

  it('migration marks people already invited from the app as pending again, and leaves the first admin alone', async () => {
    const db = await fixture()
    // state as it was before the change: both admins accepted by default; Bruno had been invited
    await db.exec(`update auth.users set invited_at = now() where id = '${OTHER_ADMIN}'`)
    await db.exec(`update admins set accepted_at = null from auth.users u where u.id = admins.user_id and u.invited_at is not null`)
    const rows = await as(db, { uid: ADMIN }, async () => (await db.query<{ email: string; pending: boolean }>('select email, pending from list_admins()')).rows)
    expect(rows).toEqual([
      { email: 'Ana@Club.pt', pending: false },
      { email: 'bruno@club.pt', pending: true },
    ])
  })

  it('invite_state tells no entry, pending invitation and accepted admin apart', async () => {
    const db = await fixture()
    await db.query(`select add_admin_by_email('carla@club.pt')`)
    const state = async (email: string) => (await db.query<{ s: string }>(`select invite_state('${email}') as s`)).rows[0].s
    expect(await state(' ANA@club.pt ')).toBe('admin')
    expect(await state('carla@club.pt')).toBe('pending')
    expect(await state('nobody@club.pt')).toBe('none')
  })

  it('keeps invite_state away from app users', async () => {
    const db = await fixture()
    for (const who of ['anon', { uid: ADMIN }] as const) {
      await as(db, who, async () => {
        await expect(db.query(`select invite_state('ana@club.pt')`)).rejects.toThrow()
      })
    }
  })

  it('keeps add_admin_by_email away from app users', async () => {
    const db = await fixture()
    for (const who of ['anon', { uid: ADMIN }] as const) {
      await as(db, who, async () => {
        await expect(db.query(`select add_admin_by_email('carla@club.pt')`)).rejects.toThrow()
      })
    }
  })

  it('the main admin cannot be removed, not even by another admin', async () => {
    const db = await fixture()
    await db.exec(`update admins set is_owner = true where user_id = '${ADMIN}'`)
    await as(db, { uid: OTHER_ADMIN }, async () => {
      await expect(db.query(`select remove_admin('${ADMIN}')`)).rejects.toThrow(/principal/)
    })
    expect((await db.query('select 1 from admins')).rows).toHaveLength(2)
    // everyone else can still be removed
    await as(db, { uid: ADMIN }, async () => {
      await db.query(`select remove_admin('${OTHER_ADMIN}')`)
    })
    expect((await db.query('select 1 from admins')).rows).toHaveLength(1)
  })

  it('lists the main admin first and says who it is', async () => {
    const db = await fixture()
    await db.exec(`update admins set is_owner = true where user_id = '${OTHER_ADMIN}'`)
    const rows = await as(db, { uid: ADMIN }, async () => (await db.query<{ email: string; is_owner: boolean }>('select email, is_owner from list_admins()')).rows)
    expect(rows).toEqual([
      { email: 'bruno@club.pt', is_owner: true },
      { email: 'Ana@Club.pt', is_owner: false },
    ])
  })

  it('the migration picks the earliest account that is an accepted admin as the main admin', async () => {
    const db = await fixture()
    await db.exec(`
      update auth.users set created_at = '2026-01-03' where id = '${ADMIN}';
      update auth.users set created_at = '2026-01-02' where id = '${OTHER_ADMIN}';
      update auth.users set created_at = '2026-01-01' where id = '${USER}';
      update admins set is_owner = false;
    `)
    await db.query(`select add_admin_by_email('carla@club.pt')`) // earliest account, but only invited: pending
    const sql = readFileSync(new URL('../migrations/20261117000000_main_admin.sql', import.meta.url), 'utf8')
    await db.exec(sql.match(/update public\.admins set is_owner = true[\s\S]*?;/)![0])
    const owners = (await db.query<{ user_id: string }>('select user_id from admins where is_owner')).rows
    expect(owners).toEqual([{ user_id: OTHER_ADMIN }])
  })
})
