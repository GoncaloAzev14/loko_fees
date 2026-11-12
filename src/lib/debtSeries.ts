export interface DebtPoint {
  date: string
  /** What the player owes on that day, never below zero. */
  owed: number
}

/**
 * How a player's debt moved over time: each fine adds to it, each payment takes from it.
 * Events on the same day collapse into one point; the first point is the first event.
 */
export function debtSeries(
  fines: { fined_on: string; amount: number; cancelled: boolean }[],
  payments: { paid_on: string; amount: number }[],
): DebtPoint[] {
  const events = [
    ...fines.filter((f) => !f.cancelled).map((f) => ({ date: f.fined_on, delta: f.amount })),
    ...payments.map((p) => ({ date: p.paid_on, delta: -p.amount })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  const points: DebtPoint[] = []
  let net = 0
  for (const e of events) {
    net = Math.round((net + e.delta) * 100) / 100
    const owed = Math.max(0, net)
    const last = points[points.length - 1]
    if (last && last.date === e.date) last.owed = owed
    else points.push({ date: e.date, owed })
  }
  return points
}
