import { debtSeries } from '../lib/debtSeries'
import { formatDate, money, parseDate } from '../lib/format'
import type { LedgerRow, Payment } from '../lib/types'

const W = 300
const H = 112
const PAD = 14

/** How much the player owed over time. Needs at least two days with movements to draw a line. */
export default function DebtChart({ fines, payments }: { fines: LedgerRow[]; payments: Payment[] }) {
  const series = debtSeries(fines, payments)
  if (series.length < 2) return null

  const t0 = parseDate(series[0].date).getTime()
  const span = parseDate(series[series.length - 1].date).getTime() - t0 || 1
  const max = Math.max(...series.map((p) => p.owed), 1)
  const pts = series.map((p) => ({
    x: PAD + ((parseDate(p.date).getTime() - t0) / span) * (W - 2 * PAD),
    y: PAD + (1 - p.owed / max) * (H - 2 * PAD - 12),
  }))
  const first = series[0]
  const last = series[series.length - 1]
  const a = pts[0]
  const b = pts[pts.length - 1]

  return (
    <div className="card" style={{ padding: 10 }}>
      <svg
        className="chart"
        viewBox={`0 0 ${W} ${H + 8}`}
        role="img"
        aria-label={`Dívida acumulada: ${money(first.owed)} em ${formatDate(first.date)} e ${money(last.owed)} em ${formatDate(last.date)}`}
      >
        <path d={[1, 2, 3].map((i) => `M0 ${(i * (H - 12)) / 4 + 6}H${W}`).join('')} stroke="#26262a" strokeWidth="1" />
        <polyline points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#f25c1f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={a.x} cy={a.y} r="6" fill="#0e0e10" stroke="#f25c1f" strokeWidth="3" />
        <circle cx={b.x} cy={b.y} r="6" fill="#f25c1f" stroke="#0e0e10" strokeWidth="3" />
        <text x={PAD} y={H + 4} fill="#a4a4ab" fontSize="10">{formatDate(first.date)}</text>
        <text x={W - PAD} y={H + 4} fill="#a4a4ab" fontSize="10" textAnchor="end">{formatDate(last.date)}</text>
      </svg>
    </div>
  )
}
