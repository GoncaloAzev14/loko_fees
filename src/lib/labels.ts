import type { FineStatus, FineType, LedgerRow } from './types'
import { parseDate } from './format'

export const STATUS_LABEL: Record<FineStatus, string> = {
  paid: 'Paga',
  pending: 'Por pagar',
  overdue: 'Vencida',
  cancelled: 'Anulada',
}

const monthName = new Intl.DateTimeFormat('pt-PT', { month: 'long' })

/** What the fine is for: the catalog name, or the late-fee wording. */
export function fineName(row: LedgerRow, types: Map<string, FineType>) {
  if (row.kind === 'late_fee') {
    return row.late_for_month
      ? `Multa de falta de pagamento (${monthName.format(parseDate(row.late_for_month))})`
      : 'Multa de falta de pagamento'
  }
  return (row.fine_type_id && types.get(row.fine_type_id)?.name) || 'Multa'
}
