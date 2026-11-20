import { describe, expect, it } from 'vitest'
import { plantelFor } from './roster'
import type { Balance } from './types'

const member = (name: string, active: boolean, role: Balance['role'] = 'player'): Balance =>
  ({ player_id: name, name, role, active, total_fined: 0, total_paid: 0, outstanding: 0, credit: 0, overdue: 0 })

describe('plantelFor', () => {
  const all = [member('Ana', true), member('Bruno', false), member('Carlos', false, 'staff'), member('Duarte', true, 'staff')]

  it('shows a visitor only the players and staff that are active', () => {
    expect(plantelFor(all, false).map((b) => b.name)).toEqual(['Ana', 'Duarte'])
  })

  it('shows an admin everyone, including the inactive, so they can be switched back on', () => {
    expect(plantelFor(all, true)).toHaveLength(4)
  })
})
