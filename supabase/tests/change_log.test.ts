import { describe, expect, it } from 'vitest'
import { as, newDb } from './db'

// Every change to the club's data is recorded by the database, with who did it. Nothing in the app can
// edit or remove the record, and a deleted row can be put back.

const ADMIN = '00000000-0000-0000-0000-00000000000a'
const OTHER = '00000000-0000-0000-0000-00000000000c'
const USER = '00000000-0000-0000-0000-00000000000b'

async function fixture() {
  const db = await newDb()
  await db.exec(`
    insert into auth.users values ('${ADMIN}', 'ana@x.pt'), ('${OTHER}', 'bia@x.pt'), ('${USER}', 'user@x.pt');
    insert into admins values ('${ADMIN}'), ('${OTHER}');
    insert into players (name) values ('Ana'), ('Bruno');
    insert into fine_types (name, default_amount) values ('Derrota', 2);
  `)
  await db.exec('delete from change_log') // start from a clean record: the fixture's own inserts do not matter here
  return db
}
type Db = Awaited<ReturnType<typeof fixture>>

type Log = { who: string | null; action: string; table_name: string; row_id: string | null; old_row: Record<string, unknown> | null; new_row: Record<string, unknown> | null }
const log = async (db: Db) => (await db.query<Log>('select who, action, table_name, row_id, old_row, new_row from change_log order by id')).rows
const playerId = async (db: Db, name: string) => (await db.query<{ id: string }>(`select id from players where name = '${name}'`)).rows[0].id

describe('recording changes', () => {
  it('writes down who added, changed and deleted what', async () => {
    const db = await fixture()
    const ana = await playerId(db, 'Ana')
    await as(db, { uid: ADMIN }, async () => {
      await db.query(`insert into payments (id, player_id, amount, paid_on) values ('10000000-0000-0000-0000-000000000001', '${ana}', 5, '2026-11-10')`)
    })
    await as(db, { uid: OTHER }, async () => {
      await db.query(`update payments set amount = 7 where id = '10000000-0000-0000-0000-000000000001'`)
      await db.query(`delete from payments where id = '10000000-0000-0000-0000-000000000001'`)
    })
    const entries = await log(db)
    expect(entries.map((e) => [e.who, e.action, e.table_name])).toEqual([
      [ADMIN, 'insert', 'payments'],
      [OTHER, 'update', 'payments'],
      [OTHER, 'delete', 'payments'],
    ])
    expect(entries[0].new_row).toMatchObject({ amount: 5 })
    expect(entries[1].old_row).toMatchObject({ amount: 5 })
    expect(entries[1].new_row).toMatchObject({ amount: 7 })
    expect(entries[2].old_row).toMatchObject({ amount: 7, player_id: ana })
    expect(entries.every((e) => e.row_id === '10000000-0000-0000-0000-000000000001')).toBe(true)
  })

  it('covers every table that holds the club\'s money and people', async () => {
    const db = await fixture()
    await as(db, { uid: ADMIN }, async () => {
      await db.query(`insert into incomes (amount, description) values (40, 'Prémio')`)
      await db.query(`insert into expenses (amount, description) values (12, 'Jantar')`)
      await db.query(`insert into players (name) values ('Carla')`)
      await db.query(`insert into fine_types (name, default_amount) values ('Atraso', 1)`)
      await db.query(`update settings set late_fine_amount = 6`)
    })
    expect((await log(db)).map((e) => e.table_name).sort()).toEqual(['expenses', 'fine_types', 'incomes', 'players', 'settings'])
  })

  it('does not log an update that changed nothing', async () => {
    const db = await fixture()
    await db.exec(`update players set name = name`)
    await db.exec(`update settings set late_fine_amount = late_fine_amount`)
    expect(await log(db)).toEqual([])
  })

  it('records the system as nobody: late fees added by the rule', async () => {
    const db = await fixture()
    await db.exec(`insert into fines (player_id, fine_type_id, amount, fined_on)
                   select p.id, t.id, 2, '2026-10-10' from players p, fine_types t where p.name = 'Ana'`)
    await db.exec('delete from change_log')
    await db.exec(`select apply_late_fees('2026-11-12')`)
    const [entry] = await log(db)
    expect(entry).toMatchObject({ who: null, action: 'insert', table_name: 'fines' })
    expect(entry.new_row).toMatchObject({ kind: 'late_fee' })
  })

  it('keeps the old rows when a season is closed, so even that can be looked back on', async () => {
    const db = await fixture()
    const ana = await playerId(db, 'Ana')
    await db.exec(`insert into payments (player_id, amount) values ('${ana}', 5)`)
    await db.exec('delete from change_log')
    await as(db, { uid: ADMIN }, async () => {
      await db.query(`select close_season('2027/28')`)
    })
    const deletes = (await log(db)).filter((e) => e.action === 'delete' && e.table_name === 'payments')
    expect(deletes).toHaveLength(1)
    expect(deletes[0].who).toBe(ADMIN)
    expect(deletes[0].old_row).toMatchObject({ amount: 5 })
  })
})

describe('who can see and change the record', () => {
  it('is closed to the app: nobody can read, edit or empty it directly, not even an admin', async () => {
    const db = await fixture()
    await db.exec(`insert into players (name) values ('Dora')`)
    for (const who of ['anon', { uid: USER }, { uid: ADMIN }] as const) {
      await as(db, who, async () => {
        await expect(db.query('select * from change_log')).rejects.toThrow()
        await expect(db.query('delete from change_log')).rejects.toThrow()
        await expect(db.query(`update change_log set who = null`)).rejects.toThrow()
        await expect(db.query(`insert into change_log (action, table_name) values ('insert', 'players')`)).rejects.toThrow()
      })
    }
    expect((await log(db)).length).toBeGreaterThan(0)
  })

  it('is read through list_changes, by admins only, newest first, with the person\'s email', async () => {
    const db = await fixture()
    await as(db, { uid: ADMIN }, async () => {
      await db.query(`insert into players (name) values ('Carla')`)
    })
    await as(db, { uid: OTHER }, async () => {
      await db.query(`insert into players (name) values ('Dora')`)
    })
    await as(db, { uid: ADMIN }, async () => {
      const rows = (await db.query<{ who_email: string; new_row: { name: string } }>('select who_email, new_row from list_changes()')).rows
      expect(rows.map((r) => [r.who_email, r.new_row.name])).toEqual([['bia@x.pt', 'Dora'], ['ana@x.pt', 'Carla']])
      expect((await db.query('select 1 from list_changes(1)')).rows).toHaveLength(1)
    })
    await as(db, { uid: USER }, async () => {
      expect((await db.query('select 1 from list_changes()')).rows).toHaveLength(0)
    })
    await as(db, 'anon', async () => {
      await expect(db.query('select 1 from list_changes()')).rejects.toThrow()
    })
  })
})

describe('putting back what was deleted', () => {
  const deletedPayment = async (db: Db) => {
    const ana = await playerId(db, 'Ana')
    await db.exec(`insert into payments (id, player_id, amount, paid_on, note) values ('10000000-0000-0000-0000-000000000009', '${ana}', 5, '2026-11-10', 'Dinheiro')`)
    await as(db, { uid: ADMIN }, async () => {
      await db.query(`delete from payments where id = '10000000-0000-0000-0000-000000000009'`)
    })
    return (await db.query<{ id: string }>(`select id from change_log where action = 'delete' and table_name = 'payments'`)).rows[0].id
  }

  it('brings a deleted payment back exactly as it was', async () => {
    const db = await fixture()
    const change = await deletedPayment(db)
    await as(db, { uid: OTHER }, async () => {
      await db.query(`select restore_change(${change})`)
    })
    const [p] = (await db.query<{ id: string; amount: string; paid_on: string; note: string }>(`select id, amount::float::text as amount, paid_on::text, note from payments`)).rows
    expect(p).toEqual({ id: '10000000-0000-0000-0000-000000000009', amount: '5', paid_on: '2026-11-10', note: 'Dinheiro' })
  })

  it('shows a delete as restorable until it has been put back, then not', async () => {
    const db = await fixture()
    const change = await deletedPayment(db)
    const restorable = async () =>
      as(db, { uid: ADMIN }, async () => (await db.query<{ restorable: boolean }>(`select restorable from list_changes() where action = 'delete'`)).rows[0].restorable)
    expect(await restorable()).toBe(true)
    await as(db, { uid: ADMIN }, async () => {
      await db.query(`select restore_change(${change})`)
    })
    expect(await restorable()).toBe(false)
  })

  it('refuses to put back the same thing twice', async () => {
    const db = await fixture()
    const change = await deletedPayment(db)
    await as(db, { uid: ADMIN }, async () => {
      await db.query(`select restore_change(${change})`)
      await expect(db.query(`select restore_change(${change})`)).rejects.toThrow(/já existe/)
    })
    expect((await db.query('select 1 from payments')).rows).toHaveLength(1)
  })

  it('puts a restored action in the record too, under whoever restored it', async () => {
    const db = await fixture()
    const change = await deletedPayment(db)
    await as(db, { uid: OTHER }, async () => {
      await db.query(`select restore_change(${change})`)
    })
    const last = (await log(db)).pop()!
    expect(last).toMatchObject({ who: OTHER, action: 'insert', table_name: 'payments' })
  })

  it('refuses anything that was not a delete, and non-admins', async () => {
    const db = await fixture()
    const change = await deletedPayment(db)
    const insertLine = (await db.query<{ id: string }>(`select id from change_log where action = 'insert' and table_name = 'payments'`)).rows[0].id
    await as(db, { uid: ADMIN }, async () => {
      await expect(db.query(`select restore_change(${insertLine})`)).rejects.toThrow(/apagada/)
      await expect(db.query(`select restore_change(999999)`)).rejects.toThrow(/já não existe/)
    })
    await as(db, { uid: USER }, async () => {
      await expect(db.query(`select restore_change(${change})`)).rejects.toThrow(/administradores/)
    })
    await as(db, 'anon', async () => {
      await expect(db.query(`select restore_change(${change})`)).rejects.toThrow()
    })
    expect((await db.query('select 1 from payments')).rows).toHaveLength(0)
  })

  it('brings back a fine, a player and a fine type too', async () => {
    const db = await fixture()
    const ana = await playerId(db, 'Ana')
    await db.exec(`insert into fines (id, player_id, fine_type_id, amount, fined_on, description)
                   select '10000000-0000-0000-0000-00000000000f', '${ana}', t.id, 3, '2026-11-01', 'atraso' from fine_types t`)
    await db.exec(`insert into players (id, name) values ('10000000-0000-0000-0000-0000000000a1', 'Zeca')`)
    await db.exec(`insert into fine_types (id, name, default_amount) values ('10000000-0000-0000-0000-0000000000b1', 'Cartão', 5)`)
    await as(db, { uid: ADMIN }, async () => {
      await db.query(`delete from fines where id = '10000000-0000-0000-0000-00000000000f'`)
      await db.query(`delete from players where id = '10000000-0000-0000-0000-0000000000a1'`)
      await db.query(`delete from fine_types where id = '10000000-0000-0000-0000-0000000000b1'`)
    })
    const lines = (await db.query<{ id: string }>(`select id from change_log where action = 'delete' order by id`)).rows
    await as(db, { uid: ADMIN }, async () => {
      for (const l of lines) await db.query(`select restore_change(${l.id})`)
    })
    expect((await db.query<{ description: string; amount: string }>(`select description, amount::float::text as amount from fines`)).rows).toEqual([{ description: 'atraso', amount: '3' }])
    expect((await db.query(`select 1 from players where name = 'Zeca'`)).rows).toHaveLength(1)
    expect((await db.query(`select 1 from fine_types where name = 'Cartão'`)).rows).toHaveLength(1)
  })

  it('says what is missing when a fine\'s player no longer exists', async () => {
    const db = await fixture()
    await db.exec(`insert into players (id, name) values ('10000000-0000-0000-0000-0000000000a2', 'Rui')`)
    await db.exec(`insert into payments (player_id, amount) values ('10000000-0000-0000-0000-0000000000a2', 4)`)
    await as(db, { uid: ADMIN }, async () => {
      await db.query(`delete from payments`)
      await db.query(`delete from players where id = '10000000-0000-0000-0000-0000000000a2'`)
    })
    const line = (await db.query<{ id: string }>(`select id from change_log where action = 'delete' and table_name = 'payments'`)).rows[0].id
    await as(db, { uid: ADMIN }, async () => {
      await expect(db.query(`select restore_change(${line})`)).rejects.toThrow(/já não existe/)
    })
  })

  it('a restored late fee is wanted again, so it is not left waived', async () => {
    const db = await fixture()
    await db.exec(`insert into fines (player_id, fine_type_id, amount, fined_on)
                   select p.id, t.id, 2, '2026-10-10' from players p, fine_types t where p.name = 'Ana'`)
    await db.exec(`select apply_late_fees('2026-11-12')`)
    await as(db, { uid: ADMIN }, async () => {
      await db.query(`delete from fines where kind = 'late_fee'`)
    })
    expect((await db.query('select 1 from late_fee_waivers')).rows).toHaveLength(1)
    const line = (await db.query<{ id: string }>(`select id from change_log where action = 'delete' and table_name = 'fines'`)).rows[0].id
    await as(db, { uid: ADMIN }, async () => {
      await db.query(`select restore_change(${line})`)
    })
    expect((await db.query('select 1 from late_fee_waivers')).rows).toHaveLength(0)
    expect((await db.query(`select 1 from fines where kind = 'late_fee'`)).rows).toHaveLength(1)
  })
})
