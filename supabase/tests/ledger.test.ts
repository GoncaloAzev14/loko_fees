import { describe, expect, it } from 'vitest'
import { as, newDb } from './db'

const ADMIN = '00000000-0000-0000-0000-00000000000a'
const USER = '00000000-0000-0000-0000-00000000000b'

async function fixture() {
  const db = await newDb()
  await db.exec(`
    insert into auth.users values ('${ADMIN}', 'admin@x.pt'), ('${USER}', 'user@x.pt');
    insert into admins values ('${ADMIN}');
    insert into players (name) values ('Ana'), ('Bruno');
    insert into fine_types (name, default_amount) values ('Derrota', 2), ('Atraso', 1);
  `)
  return db
}

const fine = (player: string, type: string, amount: number, on: string) =>
  `insert into fines (player_id, fine_type_id, amount, fined_on)
   select p.id, t.id, ${amount}, '${on}' from players p, fine_types t
   where p.name = '${player}' and t.name = '${type}';`
const pay = (player: string, amount: number, on = '2026-10-20') =>
  `insert into payments (player_id, amount, paid_on)
   select id, ${amount}, '${on}' from players where name = '${player}';`

const ledger = async (db: Awaited<ReturnType<typeof fixture>>, player: string) =>
  (await db.query<{ amount: string; paid_amount: string; status: string; due_on: Date }>(
    `select l.amount::float as amount, l.paid_amount::float as paid_amount, l.status, l.due_on
     from fine_ledger l join players p on p.id = l.player_id
     where p.name = $1 order by l.fined_on, l.seq`, [player])).rows

describe('due dates', () => {
  it('are the 7th of the month after the fine', async () => {
    const db = await fixture()
    await db.exec(fine('Ana', 'Derrota', 2, '2026-10-10') + fine('Ana', 'Derrota', 2, '2026-12-31'))
    const rows = await ledger(db, 'Ana')
    expect(rows.map((r) => r.due_on.toISOString().slice(0, 10))).toEqual(['2026-11-07', '2027-01-07'])
  })

  it('follow the configured due day', async () => {
    const db = await fixture()
    await db.exec(`update settings set due_day = 15;` + fine('Ana', 'Derrota', 2, '2026-10-10'))
    expect((await ledger(db, 'Ana'))[0].due_on.toISOString().slice(0, 10)).toBe('2026-11-15')
  })
})

describe('payments settle fines oldest-first', () => {
  it('covers whole fines, then part of the next, leaving the rest', async () => {
    const db = await fixture()
    await db.exec(
      fine('Ana', 'Derrota', 2, '2026-10-01') + fine('Ana', 'Atraso', 1, '2026-10-02') +
      fine('Ana', 'Derrota', 2, '2026-10-03') + pay('Ana', 4))
    const rows = await ledger(db, 'Ana')
    expect(rows.map((r) => [r.paid_amount, r.status])).toEqual([
      [2, 'paid'], [1, 'paid'], [1, 'overdue'], // 4 = 2 + 1 + 1 of the last one (due 7 Nov, today is later)
    ])
  })

  it('turns any surplus into credit', async () => {
    const db = await fixture()
    await db.exec(fine('Ana', 'Derrota', 2, '2026-10-01') + pay('Ana', 5))
    const { rows } = await db.query<{ outstanding: string; credit: string }>(
      `select outstanding::float, credit::float from player_balance where name = 'Ana'`)
    expect(rows[0]).toEqual({ outstanding: 0, credit: 3 })
  })

  it('ignores cancelled fines', async () => {
    const db = await fixture()
    await db.exec(fine('Ana', 'Derrota', 2, '2026-10-01') + fine('Ana', 'Atraso', 1, '2026-10-02') +
      `update fines set cancelled = true where amount = 2;` + pay('Ana', 1))
    const rows = await ledger(db, 'Ana')
    expect(rows.map((r) => r.status)).toEqual(['cancelled', 'paid'])
    const { rows: [b] } = await db.query<{ total_fined: string }>(
      `select total_fined::float from player_balance where name = 'Ana'`)
    expect(b.total_fined).toBe(1)
  })

  it('does not mix players', async () => {
    const db = await fixture()
    await db.exec(fine('Ana', 'Derrota', 2, '2026-10-01') + fine('Bruno', 'Derrota', 2, '2026-10-01') + pay('Ana', 2))
    expect((await ledger(db, 'Bruno'))[0].status).toBe('overdue')
  })

  it('marks fines pending until their due date', async () => {
    const db = await fixture()
    await db.exec(fine('Ana', 'Derrota', 2, '2999-01-01'))
    expect((await ledger(db, 'Ana'))[0].status).toBe('pending')
  })
})

describe('club summary', () => {
  it('box = payments + income - expenses', async () => {
    const db = await fixture()
    await db.exec(fine('Ana', 'Derrota', 2, '2026-10-01') + fine('Bruno', 'Derrota', 2, '2026-10-01') + pay('Ana', 2) +
      `insert into incomes (amount, description) values (100, 'Prémio');
       insert into expenses (amount, description) values (30, 'Jantar');`)
    const { rows: [s] } = await db.query<Record<string, number>>(
      `select box::float, total_outstanding::float, total_overdue::float, total_credit::float from club_summary`)
    expect(s).toEqual({ box: 72, total_outstanding: 2, total_overdue: 2, total_credit: 0 })
  })

  it('is all zeros on an empty database', async () => {
    const { rows: [s] } = await (await newDb()).query<Record<string, number>>(
      `select box::float, total_outstanding::float from club_summary`)
    expect(s).toEqual({ box: 0, total_outstanding: 0 })
  })
})

describe('late fees', () => {
  const run = (db: Awaited<ReturnType<typeof fixture>>, today: string) =>
    db.query<{ n: number }>(`select apply_late_fees('${today}') as n`).then((r) => r.rows[0].n)

  it('are added once per player per month when fines are still unpaid after the due date', async () => {
    const db = await fixture()
    await db.exec(fine('Ana', 'Derrota', 2, '2026-10-01') + fine('Ana', 'Derrota', 2, '2026-10-20') +
      fine('Bruno', 'Derrota', 2, '2026-10-05') + pay('Bruno', 2))
    expect(await run(db, '2026-11-07')).toBe(0) // due date itself is still in time
    expect(await run(db, '2026-11-08')).toBe(1) // only Ana, once despite two unpaid fines
    expect(await run(db, '2026-11-09')).toBe(0) // idempotent
    const { rows } = await db.query<{ name: string; amount: string; fined_on: Date }>(
      `select p.name, f.amount::float as amount, f.fined_on from fines f join players p on p.id = f.player_id
       where f.kind = 'late_fee'`)
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Ana')
    expect(rows[0].amount).toBe(5)
    expect(rows[0].fined_on.toISOString().slice(0, 10)).toBe('2026-11-08')
  })

  it('use the configured amount and do not trigger further late fees', async () => {
    const db = await fixture()
    await db.exec(`update settings set late_fine_amount = 7;` + fine('Ana', 'Derrota', 2, '2026-10-01'))
    await run(db, '2026-11-08')
    await run(db, '2026-12-20') // the unpaid late fee itself must not cause another one
    const { rows } = await db.query<{ amount: string; late_for_month: Date }>(
      `select amount::float as amount, late_for_month from fines where kind = 'late_fee'`)
    expect(rows).toHaveLength(1)
    expect(rows[0].amount).toBe(7)
  })

  it('adds one per month when an older month is still unpaid', async () => {
    const db = await fixture()
    await db.exec(fine('Ana', 'Derrota', 2, '2026-10-01') + fine('Ana', 'Derrota', 2, '2026-11-01'))
    await run(db, '2026-11-08')
    expect(await run(db, '2026-12-08')).toBe(1) // November fine is now overdue too
  })

  it('are not recreated after the admin cancels them', async () => {
    const db = await fixture()
    await db.exec(fine('Ana', 'Derrota', 2, '2026-10-01'))
    await run(db, '2026-11-08')
    await db.exec(`update fines set cancelled = true where kind = 'late_fee'`)
    expect(await run(db, '2026-11-09')).toBe(0)
  })
})

describe('access control', () => {
  it('lets anonymous visitors read everything but write nothing', async () => {
    const db = await fixture()
    await db.exec(fine('Ana', 'Derrota', 2, '2026-10-01'))
    await as(db, 'anon', async () => {
      expect((await db.query('select * from fine_ledger')).rows).toHaveLength(1)
      expect((await db.query('select * from club_summary')).rows).toHaveLength(1)
      await expect(db.exec(`insert into payments (player_id, amount) select id, 1 from players`)).rejects.toThrow()
      await expect(db.exec(`update settings set late_fine_amount = 0`)).rejects.toThrow()
      await expect(db.query('select apply_late_fees()')).rejects.toThrow()
      await expect(db.query('select apply_late_fees_admin()')).rejects.toThrow()
    })
  })

  it('does not let signed-in non-admins write', async () => {
    const db = await fixture()
    await as(db, { uid: USER }, async () => {
      await expect(db.exec(`insert into expenses (amount, description) values (1, 'x')`)).rejects.toThrow()
      await expect(db.query('select apply_late_fees_admin()')).rejects.toThrow(/admin only/)
    })
  })

  it('lets admins write and trigger late fees', async () => {
    const db = await fixture()
    await as(db, { uid: ADMIN }, async () => {
      await db.exec(`insert into expenses (amount, description) values (1, 'x')`)
      await db.exec(`update settings set late_fine_amount = 6`)
      await db.query('select apply_late_fees_admin()')
    })
    expect((await db.query('select * from expenses')).rows).toHaveLength(1)
  })
})
