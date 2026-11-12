import { describe, expect, it } from 'vitest'
import { newDb } from './db'

// The demo data must reproduce the figures in 'Lokomotiv 26-27.xlsx'.
describe('demo seed', async () => {
  const db = await newDb({ seed: true })
  const one = async <T extends object>(sql: string) => (await db.query<T>(sql)).rows[0]

  it('has the box value of the sheet', async () => {
    expect((await one<{ box: number }>(`select box::float from club_summary`)).box).toBe(124)
  })

  it('has the sheet totals for fines and income', async () => {
    const r = await one<{ fined: number; income: number }>(
      `select (select sum(amount) from fines)::float as fined, (select sum(amount) from incomes)::float as income`)
    expect(r).toEqual({ fined: 250, income: 140 }) // sheet total 390 = 250 fines + 140 prizes/gifts
  })

  it('keeps the credit of Rodrigo Mendes', async () => {
    expect(await one(`select outstanding::float, credit::float from player_balance where name = 'Rodrigo Mendes'`))
      .toEqual({ outstanding: 0, credit: 2 })
  })

  it('has no stray players or typos', async () => {
    expect((await db.query(`select 1 from players`)).rows).toHaveLength(23)
    expect((await db.query(`select 1 from players where name = 'Marcus'`)).rows).toHaveLength(0)
  })

  it('imports the sheet\'s 7 late fees; the app rule would also fine two players the sheet missed', async () => {
    const lateFeePlayers = async () =>
      (await db.query<{ name: string }>(
        `select p.name from fines f join players p on p.id = f.player_id where f.kind = 'late_fee' order by 1`)).rows.map((r) => r.name)
    const before = await lateFeePlayers()
    expect(before).toHaveLength(7)
    await db.query(`select apply_late_fees('2026-11-12')`)
    // João has an unpaid October red card, Miguel Bombeiro an unpaid October lateness: both overdue, neither fined in the sheet.
    expect((await lateFeePlayers()).filter((n) => !before.includes(n))).toEqual(['João', 'Miguel Bombeiro'])
  })
})
