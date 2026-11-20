import type { Balance } from './types'

/**
 * Who the Plantel page lists. Everyone sees the members who are active; only an admin also sees the ones that were
 * switched off, so that they can be switched back on. (Their fines and payments stay in the books either way.)
 */
export function plantelFor(list: Balance[], isAdmin: boolean): Balance[] {
  return isAdmin ? list : list.filter((b) => b.active)
}
