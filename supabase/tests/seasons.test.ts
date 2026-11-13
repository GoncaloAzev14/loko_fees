import { describe, expect, it } from 'vitest'
import { as, newDb } from './db'

const ADMIN = '00000000-0000-0000-0000-00000000000a'
const USER = '00000000-0000-0000-0000-00000000000b'

type Db = Awaited<ReturnType<typeof newDb>>

async function fixture() {
  const db = await newDb()
  await db.exec(`
    insert into auth.users values ('${ADMIN}', 'admin@x.pt'), ('${USER}', 'user@x.pt');
    insert into admins values ('${ADMIN}');
    insert into players (name, role) values ('Ana', 'player'), ('Bruno', 'staff'), ('Carla', 'player');
    insert into fine_types (name, default_amount) values ('Derrota', 2), ('Atraso', 1), ('Nunca usada', 9);
  `)
  return db
}

const fine = (player: string, type: string, amount: number, on = '2026-10-01') =>
  `insert into fines (player_id, fine_type_id, amount, fined_on)
   select p.id, t.id, ${amount}, '${on}' from players p, fine_types t where p.name = '${player}' and t.name = '${type}';`
const pay = (player: string, amount: number) =>
  `insert into payments (player_id, amount) select id, ${amount} from players where name = '${player}';`
const count = async (db: Db, table: string) => (await db.query<{ n: number }>(`select count(*)::int as n from ${table}`)).rows[0].n
const box = async (db: Db) => (await db.query<{ box: number }>('select box::float from club_summary')).rows[0].box

describe('deleting players and fine types', () => {
  it('lets an admin delete a player and a fine type nothing depends on', async () => {
    const db = await fixture()
    await as(db, { uid: ADMIN }, async () => {
      await db.exec(`delete from players where name = 'Carla'`)
      await db.exec(`delete from fine_types where name = 'Nunca usada'`)
    })
    expect(await count(db, 'players')).toBe(2)
    expect(await count(db, 'fine_types')).toBe(2)
  })

  it('refuses to delete a player with fines, so their data and money cannot vanish', async () => {
    const db = await fixture()
    await db.exec(fine('Ana', 'Derrota', 2))
    await as(db, { uid: ADMIN }, async () => {
      await expect(db.exec(`delete from players where name = 'Ana'`)).rejects.toThrow(/foreign key/)
    })
    expect(await count(db, 'players')).toBe(3)
  })

  it('refuses to delete a player with payments, which would shrink the box', async () => {
    const db = await fixture()
    await db.exec(pay('Bruno', 5))
    await as(db, { uid: ADMIN }, async () => {
      await expect(db.exec(`delete from players where name = 'Bruno'`)).rejects.toThrow(/foreign key/)
    })
    expect(await box(db)).toBe(5)
  })

  it('refuses to delete a fine type that fines use', async () => {
    const db = await fixture()
    await db.exec(fine('Ana', 'Derrota', 2))
    await as(db, { uid: ADMIN }, async () => {
      await expect(db.exec(`delete from fine_types where name = 'Derrota'`)).rejects.toThrow(/foreign key/)
    })
  })

  it('does not let non-admins delete anything', async () => {
    const db = await fixture()
    await as(db, { uid: USER }, async () => {
      await db.exec(`delete from players`)
      await db.exec(`delete from fine_types`)
    })
    expect(await count(db, 'players')).toBe(3)
    expect(await count(db, 'fine_types')).toBe(3)
  })
})

describe('season setting', () => {
  it('defaults to 2026/27', async () => {
    const { rows } = await (await newDb()).query<{ season: string }>('select season from settings')
    expect(rows[0].season).toBe('2026/27')
  })

  it('can be edited by an admin, but not to a malformed value', async () => {
    const db = await fixture()
    await as(db, { uid: ADMIN }, async () => {
      await db.exec(`update settings set season = '2027/28'`)
      await expect(db.exec(`update settings set season = 'abc'`)).rejects.toThrow()
    })
    expect((await db.query<{ season: string }>('select season from settings')).rows[0].season).toBe('2027/28')
  })
})

describe('closing a season', () => {
  async function busySeason() {
    const db = await fixture()
    await db.exec(
      fine('Ana', 'Derrota', 2) + fine('Ana', 'Atraso', 1) + fine('Bruno', 'Derrota', 2) +
      pay('Ana', 3) + pay('Bruno', 5) + // Bruno overpays by 3
      `insert into incomes (amount, description) values (100, 'Prémio');
       insert into expenses (amount, description) values (30, 'Jantar');
       select apply_late_fees('2026-11-08');`)
    return db // Ana owes 0, Bruno has 3 credit, Carla untouched; late fee for Bruno? (his fine is paid) none
  }

  const close = (db: Db, next = '2027/28') => as(db, { uid: ADMIN }, () => db.query<{ id: string }>(`select close_season('${next}') as id`))

  it('archives totals, per player and per fine type', async () => {
    const db = await busySeason()
    const boxBefore = await box(db)
    const { rows: [{ id }] } = await close(db)
    const { rows: [a] } = await db.query<Record<string, string | number>>(
      `select season, fines_count, total_fined::float, total_paid::float, total_income::float, total_expenses::float, box::float, total_credit::float
       from season_archive where id = '${id}'`)
    expect(a).toEqual({ season: '2026/27', fines_count: 3, total_fined: 5, total_paid: 8, total_income: 100, total_expenses: 30, box: boxBefore, total_credit: 3 })
    const players = (await db.query<{ player_name: string; outstanding: number; credit: number }>(
      `select player_name, outstanding::float, credit::float from season_archive_players where archive_id = '${id}' order by player_name`)).rows
    expect(players).toEqual([{ player_name: 'Ana', outstanding: 0, credit: 0 }, { player_name: 'Bruno', outstanding: 0, credit: 3 }]) // Carla had no activity
    const types = (await db.query<{ fine_type: string; fines_count: number; total_amount: number }>(
      `select fine_type, fines_count, total_amount::float from season_archive_types where archive_id = '${id}' order by fine_type`)).rows
    expect(types).toEqual([{ fine_type: 'Atraso', fines_count: 1, total_amount: 1 }, { fine_type: 'Derrota', fines_count: 2, total_amount: 4 }])
  })

  it('clears fines, payments, income and expenses but keeps players and fine types', async () => {
    const db = await busySeason()
    await close(db)
    expect(await count(db, 'fines')).toBe(0)
    expect(await count(db, 'payments')).toBe(0)
    expect(await count(db, 'expenses')).toBe(0)
    expect(await count(db, 'players')).toBe(3)
    expect(await count(db, 'fine_types')).toBe(3)
  })

  it('carries the cash over, so the box is unchanged', async () => {
    const db = await busySeason()
    const before = await box(db)
    expect(before).toBe(78) // 8 paid + 100 income - 30 expenses
    await close(db)
    expect(await box(db)).toBe(before)
    const { rows } = await db.query<{ description: string }>('select description from incomes')
    expect(rows).toEqual([{ description: 'Saldo transitado da época 2026/27' }])
  })

  it('carries a negative box over as an expense', async () => {
    const db = await fixture()
    await db.exec(`insert into expenses (amount, description) values (40, 'Equipamento')`)
    await close(db)
    expect(await box(db)).toBe(-40)
  })

  it('starts the next season, and the players can then be deleted', async () => {
    const db = await busySeason()
    await close(db, '2027/28')
    expect((await db.query<{ season: string }>('select season from settings')).rows[0].season).toBe('2027/28')
    await as(db, { uid: ADMIN }, async () => {
      await db.exec(`delete from players where name = 'Ana'`)
    })
    expect(await count(db, 'players')).toBe(2)
  })

  it('rejects the current season, a malformed one, non-admins and visitors', async () => {
    const db = await busySeason()
    await as(db, { uid: ADMIN }, async () => {
      await expect(db.query(`select close_season('2026/27')`)).rejects.toThrow(/diferente/)
      await expect(db.query(`select close_season('abc')`)).rejects.toThrow(/inválida/)
    })
    await as(db, { uid: USER }, async () => {
      await expect(db.query(`select close_season('2027/28')`)).rejects.toThrow(/administradores/)
    })
    await as(db, 'anon', async () => {
      await expect(db.query(`select close_season('2027/28')`)).rejects.toThrow()
    })
    expect(await count(db, 'fines')).toBe(3) // nothing was touched
    expect(await count(db, 'season_archive')).toBe(0)
  })

  it('keeps the archive private to admins', async () => {
    const db = await busySeason()
    await close(db)
    await as(db, { uid: ADMIN }, async () => {
      expect((await db.query('select * from season_archive')).rows).toHaveLength(1)
    })
    await as(db, { uid: USER }, async () => {
      expect((await db.query('select * from season_archive')).rows).toHaveLength(0)
      expect((await db.query('select * from season_archive_players')).rows).toHaveLength(0)
    })
    await as(db, 'anon', async () => {
      await expect(db.query('select * from season_archive')).rejects.toThrow()
    })
  })

  it('lets an admin delete an archived season, taking its detail rows along', async () => {
    const db = await busySeason()
    await close(db)
    await as(db, { uid: ADMIN }, async () => {
      await db.exec('delete from season_archive')
    })
    expect(await count(db, 'season_archive_players')).toBe(0)
    expect(await count(db, 'season_archive_types')).toBe(0)
  })

  it('cannot write the archive directly, even as an admin', async () => {
    const db = await fixture()
    await as(db, { uid: ADMIN }, async () => {
      await expect(db.exec(`insert into season_archive (season, fines_count, total_fined, total_paid, total_outstanding, total_credit, total_income, total_expenses, box)
        values ('2020/21', 0, 0, 0, 0, 0, 0, 0, 0)`)).rejects.toThrow()
    })
  })
})
