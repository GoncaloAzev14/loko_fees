import { describe, expect, it } from 'vitest'
import { newDb } from './db'

// The demo data is invented (scripts/build_seed.py). These tests check that it is usable and
// consistent, not any particular figure, so regenerating it does not break them.
describe('demo seed', async () => {
  const db = await newDb({ seed: true })
  const one = async <T extends object>(sql: string) => (await db.query<T>(sql)).rows[0]
  const count = async (sql: string) => (await db.query(sql)).rows.length

  it('has a small club: players and staff, a catalog, and nothing inactive', async () => {
    expect(await count(`select 1 from players where role = 'player' and active`)).toBe(21)
    expect(await count(`select 1 from players where role = 'staff' and active`)).toBe(2)
    expect(await count(`select 1 from players where not active`)).toBe(0)
    expect(await count(`select 1 from fine_types`)).toBe(9)
    expect(await count(`select name from players group by name having count(*) > 1`)).toBe(0) // names are unique
  })

  it('has fines, payments and income inside the demo period, all with an amount', async () => {
    expect(await count(`select 1 from fines where kind = 'fine'`)).toBeGreaterThan(30)
    expect(await count(`select 1 from payments`)).toBeGreaterThan(20)
    expect(await count(`select 1 from incomes`)).toBe(2)
    expect(await count(`select 1 from fines where amount <= 0`)).toBe(0)
    expect(await count(`select 1 from fines where fined_on not between '2026-10-01' and '2026-11-08'`)).toBe(0)
  })

  it('has no expenses, so the box is everything paid in', async () => {
    expect(await count(`select 1 from expenses`)).toBe(0)
    const r = await one<{ box: number; paid_in: number }>(
      `select box::float, ((select sum(amount) from payments) + (select sum(amount) from incomes))::float as paid_in from club_summary`)
    expect(r.box).toBeGreaterThan(0)
    expect(r.box).toBe(r.paid_in)
  })

  it('shows every kind of situation: paid, still owed, overdue and one player with credit', async () => {
    expect(await count(`select 1 from fine_ledger where paid_amount > 0`)).toBeGreaterThan(0)
    expect(await count(`select 1 from fine_ledger where remaining > 0`)).toBeGreaterThan(0)
    expect(await count(`select 1 from player_balance where overdue > 0`)).toBeGreaterThan(0)
    expect((await db.query<{ credit: number }>(`select credit::float from player_balance where credit > 0`)).rows).toEqual([{ credit: 2 }])
  })

  it('already has the late fees due on the last demo day, so applying the rule again adds none', async () => {
    expect(await count(`select 1 from fines where kind = 'late_fee'`)).toBeGreaterThan(0)
    expect((await one<{ n: number }>(`select apply_late_fees('2026-11-08') as n`)).n).toBe(0)
  })

  it('fines a player late only when an October fine of theirs is still unpaid after its due date', async () => {
    const rows = (await db.query<{ remaining: number }>(
      `select (select coalesce(sum(l.remaining), 0)
                 from fine_ledger l
                where l.player_id = f.player_id and l.kind = 'fine' and not l.cancelled
                  and date_trunc('month', l.fined_on) = date '2026-10-01')::float as remaining
         from fines f where f.kind = 'late_fee'`)).rows
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((r) => r.remaining > 0)).toBe(true)
  })
})
